import {derived, get, writable} from "svelte/store"
import {
  call,
  chunks,
  groupBy,
  indexBy,
  initArray,
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
import {isEventMuted, isPubkeyMuted} from "@app/features/social/muting"

// A like and a repost both name what they answer, and both are drawn as that.
export const DISCOVER_KINDS = [REACTION, REPOST, GENERIC_REPOST]

// The event a follow answered, and the follow whose answer it is.
export type DiscoverAnswer = {
  ref: EventRef
  pubkey: string
}

// An a tag names an addressable event outright, and NIP-25 names any other in the last e tag,
// since a reaction copies the tags of the note it answers.
const getTargetTag = (tags: string[][]): Maybe<string[]> => {
  const address = matchTag(addressTags("a"), tags)

  if (address) {
    return address
  }

  const ids = matchTags(hexTags("e"), tags)

  return ids[ids.length - 1]
}

// A zap receipt is signed by the recipient's wallet, so the request inside it names the zapper and
// the event that was zapped.
export const getDiscoverAnswer = (event: TrustedEvent): Maybe<DiscoverAnswer> => {
  const receipt = event.kind === ZAP_RECEIPT ? reader(ZapReceipt)(event).parse() : undefined
  const tagGroups = receipt ? [event.tags, receipt.request()?.tags ?? []] : [event.tags]

  for (const tags of tagGroups) {
    const tag = getTargetTag(tags)

    if (tag) {
      const ref = EventRef.fromString(tag[1], getRelayHints(tag))
      const pubkey = tagValue(tagSpec("p"), tags) ?? ref.pubkey

      return {
        ref: new EventRef({
          id: ref.id,
          kind: ref.kind,
          identifier: ref.identifier,
          pubkey,
          relays: ref.relays,
        }),
        pubkey: receipt ? (receipt.sender() ?? event.pubkey) : event.pubkey,
      }
    }
  }
}

// One card in the discover feed: what a follow answered, and the event it names of whatever kind.
export type DiscoverEntry = {
  key: string
  ref: EventRef
  event?: TrustedEvent
  interactions: TrustedEvent[]
  pubkeys: string[]
  timestamp: number
}

// What the reader's follows liked, reposted or zapped, the ones most of them answered first.
export const groupDiscoverEvents = (events: TrustedEvent[]): DiscoverEntry[] => {
  const items = events.flatMap(event => {
    const answer = getDiscoverAnswer(event)

    if (!answer) {
      return []
    }

    const key = answer.ref.getAddressOrId()

    return key ? [{key, ...answer, event}] : []
  })

  const entries = Array.from(
    groupBy(item => item.key, items),
    ([key, group]): DiscoverEntry => {
      const answered = group.map(({event}) => event)

      return {
        key,
        ref: group.map(({ref}) => ref).reduce(EventRef.merge),
        interactions: answered,
        pubkeys: uniq(group.map(({pubkey}) => pubkey)),
        timestamp: Math.max(...answered.map(event => event.created_at)),
      }
    },
  )

  return entries.sort((a, b) => b.pubkeys.length - a.pubkeys.length || b.timestamp - a.timestamp)
}

/** What the reader's follows liked, reposted or zapped. The caller draws it and owns its context. */
export const makeDiscoverFeed = () => {
  const pages = writable<TrustedEvent[][]>([])
  const states = writable<FeedLoadState[]>([])
  const drawn = writable<string[]>([])
  const anchors = writable(new Map<string, Maybe<TrustedEvent>>())
  const unsubscribers: (() => void)[] = []
  const loaders: ReturnType<typeof makeFeedLoader>[] = []

  let admitting = false
  let stopped = false

  // A reader who muted someone is not told what that person answered: a like or a repost names its
  // author, while a receipt is signed by the payee's wallet and names the zapper in its request.
  const candidates = derived(
    [pages, isEventMuted, isPubkeyMuted],
    ([$pages, $isEventMuted, $isPubkeyMuted]) =>
      uniqBy(
        event => event.id,
        $pages.flat().filter(event => {
          const answer = getDiscoverAnswer(event)

          return !(answer && $isPubkeyMuted(answer.pubkey)) && !$isEventMuted(event)
        }),
      ),
  )

  const grouped = derived(candidates, groupDiscoverEvents)

  // What the feed holds and has not drawn, best liked first. An entry waits here for its event.
  const buffer = derived([grouped, anchors], ([$grouped, $anchors]) =>
    $grouped.filter(entry => !$anchors.has(entry.key)),
  )

  const entries = derived(
    [grouped, drawn, anchors, isEventMuted],
    ([$grouped, $drawn, $anchors, $isEventMuted]) => {
      const byKey = indexBy(entry => entry.key, $grouped)
      // More interactions keep arriving and reorder the group, so a card stays where it was drawn.
      const ordered = removeUndefined($drawn.map(key => byKey.get(key)))

      return ordered
        .map(entry => ({...entry, event: $anchors.get(entry.key)}))
        .filter(entry => entry.event && !$isEventMuted(entry.event))
    },
  )

  const loading = derived(
    [states, buffer],
    ([$states, $buffer]) => $states.some(isFeedLoading) || $buffer.length > 0,
  )

  const exhausted = derived(
    states,
    $states => $states.length > 0 && $states.every(state => state.status === "exhausted"),
  )

  // Every entry's event is in hand before it is drawn, so no card gains one above it afterwards.
  const admit = async () => {
    // Drawing waits on each entry's event, so the page grows too slowly to say when to fetch.
    if (get(buffer).length < 20) {
      loaders.forEach(loader => loader.run())
    }

    const batch = take(10, get(buffer))

    if (!admitting && batch.length > 0) {
      admitting = true

      try {
        // An event nobody can find would hold up every entry below it
        const deadline = sleep(6000).then(() => undefined)

        const loads = batch.map(async entry => {
          // Drawing waits on these, so they go out at the feed's own priority rather than behind its spans.
          const event =
            entry.event ??
            (await Promise.race([notes.get().load(entry.ref, {priority: 1}), deadline]))

          return [entry.key, event] as const
        })

        // Released in order, so an entry waits on what is above it and not on the whole batch.
        for (const load of loads) {
          const [key, event] = await load

          anchors.update($anchors => new Map($anchors).set(key, event))
          drawn.update($drawn => [...$drawn, key])
        }
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
      const filters: Filter[] = [{kinds: DISCOVER_KINDS, authors: pubkeys}]

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

    // Nobody to ask means nothing to show, rather than a spinner that never stops.
    if (count === 0) {
      states.set([{status: "exhausted"}])
    }

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

  return {candidates, entries, loading, exhausted, start, stop}
}
