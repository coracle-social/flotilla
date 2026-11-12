import {derived, get, writable} from "svelte/store"
import {
  call,
  chunks,
  groupBy,
  initArray,
  last,
  max,
  noop,
  partition,
  removeUndefined,
  shuffle,
  sleep,
  take,
  uniq,
  uniqBy,
} from "@welshman/lib"
import type {Maybe} from "@welshman/lib"
import {
  EventRef,
  GENERIC_REPOST,
  REACTION,
  REPOST,
  ZAP_RECEIPT,
  addressTags,
  getRelayHints,
  hexTags,
  matchTag,
  matchTags,
  outbox,
  tagSpec,
  tagValue,
} from "@welshman/util"
import type {Filter, TrustedEvent} from "@welshman/util"
import {ZapReceipt} from "@welshman/domain"
import {createScroller} from "@lib/html"
import {reader} from "@app/core/domain"
import {ENABLE_ZAPS, PLATFORM_RELAYS} from "@app/core/env"
import {relayLists, router} from "@app/core/plugins"
import {isFeedLoading, makeFeed, makeFeedLoader} from "@app/features/feeds"
import type {FeedLoadState} from "@app/features/feeds"
import {notes} from "@app/features/social/notes"

// The event a follow answered, and the follow whose answer it is.
type Answer = {
  ref: EventRef
  pubkey: string
}

// Every answer to one event, and how many follows gave one.
type PopularEntry = {
  key: string
  ref: EventRef
  pubkeys: string[]
  timestamp: number
}

// An a tag names an addressable event, and NIP-25 names any other in the last e tag.
const getTargetTag = (tags: string[][]): Maybe<string[]> =>
  matchTag(addressTags("a"), tags) ?? last(matchTags(hexTags("e"), tags))

// A zap receipt is signed by the recipient's wallet, so the request inside it names the zapper.
const getAnswer = (event: TrustedEvent): Maybe<Answer> => {
  const receipt = event.kind === ZAP_RECEIPT ? reader(ZapReceipt)(event).parse() : undefined
  const tagGroups = receipt ? [event.tags, receipt.request()?.tags ?? []] : [event.tags]

  for (const tags of tagGroups) {
    const tag = getTargetTag(tags)

    if (tag) {
      const target = EventRef.fromString(tag[1], getRelayHints(tag))

      return {
        ref: EventRef.merge({pubkey: tagValue(tagSpec("p"), tags)}, target),
        pubkey: receipt ? (receipt.sender() ?? event.pubkey) : event.pubkey,
      }
    }
  }
}

// What the reader's follows answered, the events most of them answered first.
const groupAnswers = (events: TrustedEvent[]): PopularEntry[] => {
  const answers = events.flatMap(event => {
    const answer = getAnswer(event)
    const key = answer?.ref.getAddressOrId()

    return answer && key ? [{key, event, ...answer}] : []
  })

  const entries = Array.from(
    groupBy(answer => answer.key, answers),
    ([key, group]): PopularEntry => ({
      key,
      ref: group.map(({ref}) => ref).reduce(EventRef.merge),
      pubkeys: uniq(group.map(({pubkey}) => pubkey)),
      timestamp: max(group.map(({event}) => event.created_at)),
    }),
  )

  return entries.sort((a, b) => b.pubkeys.length - a.pubkeys.length || b.timestamp - a.timestamp)
}

/** The notes the reader's follows liked, reposted or zapped. The caller draws them. */
export const makePopularFeed = () => {
  const pages = writable<TrustedEvent[][]>([])
  const states = writable<FeedLoadState[]>([])
  const targets = writable(new Map<string, Maybe<TrustedEvent>>())
  const unsubscribers: (() => void)[] = []
  const loaders: ReturnType<typeof makeFeedLoader>[] = []

  let admitting = false
  let stopped = false

  // Nothing a reader muted is dropped, since a muted person's answer still brings the note it named.
  const entries = derived(pages, $pages => groupAnswers(uniqBy(event => event.id, $pages.flat())))

  // The entries whose note hasn't been loaded yet, best liked first.
  const buffer = derived([entries, targets], ([$entries, $targets]) =>
    $entries.filter(entry => !$targets.has(entry.key)),
  )

  const loadedNotes = derived(targets, $targets => removeUndefined(Array.from($targets.values())))

  const loading = derived(
    [states, buffer],
    ([$states, $buffer]) => $states.some(isFeedLoading) || $buffer.length > 0,
  )

  const admit = async () => {
    // Notes join only once loaded, so the buffer rather than the page says when to fetch more.
    if (get(buffer).length < 20) {
      loaders.forEach(loader => loader.run())
    }

    const batch = take(10, get(buffer))

    if (!admitting && batch.length > 0) {
      admitting = true

      try {
        // A note nobody can find would hold up the rest of the batch
        const deadline = sleep(6000).then(() => undefined)

        await Promise.all(
          batch.map(async entry => {
            // At the feed's own priority, so these don't wait behind its spans.
            const note = await Promise.race([notes.get().load(entry.ref, {priority: 1}), deadline])

            targets.update($targets => new Map($targets).set(entry.key, note))
          }),
        )
      } finally {
        admitting = false
      }
    }
  }

  const settle = () => loaders.forEach(loader => loader.settle())

  // Each group walks its own timeline, so a slow group holds up nobody else's next page.
  const startGroup = async (pubkeys: string[], index: number) => {
    const scenario = await router.get().resolve(pubkeys.map(pubkey => outbox(pubkey)))
    const relays = scenario.limit(10).getUrls()

    if (!stopped) {
      // A like and a repost both name what they answer.
      const filters: Filter[] = [{kinds: [REACTION, REPOST, GENERIC_REPOST], authors: pubkeys}]

      // A receipt pays its recipient rather than being published by the zapper, so it is found by who it names.
      if (ENABLE_ZAPS) {
        filters.push({kinds: [ZAP_RECEIPT], "#p": pubkeys})
      }

      const feed = makeFeed({
        relays,
        // Half the group's relays answering is enough to show its page, since the rest get asked again.
        quorum: 0.5,
        useCache: false,
        filters,
      })

      const loader = makeFeedLoader(feed.loadOlder)

      loaders.push(loader)
      unsubscribers.push(
        feed.events.subscribe($events =>
          pages.update($pages => {
            $pages[index] = $events

            return $pages
          }),
        ),
        loader.subscribe($state =>
          states.update($states => {
            $states[index] = $state

            return $states
          }),
        ),
        feed.cleanup,
      )
    }
  }

  // One selection over every follow lands on the few biggest relays, so each group scores its own.
  const start = (element: HTMLElement, pubkeys: string[]) => {
    // Every group would ask the same platform relays, so there they're asked once for everyone.
    const [known, unknown] =
      PLATFORM_RELAYS.length > 0
        ? [pubkeys, []]
        : partition(pubkey => Boolean(relayLists.get().get(pubkey)), pubkeys)
    const groups =
      PLATFORM_RELAYS.length > 0
        ? [known]
        : chunks(3, shuffle(known)).filter(group => group.length > 0)
    const count = unknown.length > 0 ? groups.length + 1 : groups.length
    const scroller = createScroller({element, delay: 300, onScroll: admit, onSettle: settle})

    pages.set(initArray(count, () => []))
    states.set(initArray(count, () => ({status: "idle"})))

    groups.forEach(startGroup)
    unsubscribers.push(scroller.stop)

    // A follow whose relay list has to be fetched, or who has none, would hold up a whole group
    if (unknown.length > 0) {
      Promise.all(unknown.map(pubkey => relayLists.get().load(pubkey).catch(noop))).then(() =>
        startGroup(unknown, groups.length),
      )
    }
  }

  const stop = () => {
    stopped = true
    unsubscribers.forEach(call)
  }

  return {notes: loadedNotes, loading, start, stop}
}
