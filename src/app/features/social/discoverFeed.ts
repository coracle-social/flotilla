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
  uniqBy,
} from "@welshman/lib"
import type {Maybe} from "@welshman/lib"
import {
  EventRef,
  GENERIC_REPOST,
  REACTION,
  REPOST,
  getRelayHints,
  outbox,
  tagSpec,
  tagValue,
} from "@welshman/util"
import type {TrustedEvent} from "@welshman/util"
import {createScroller} from "@lib/html"
import {relayLists, router} from "@app/core/plugins"
import {PLATFORM_RELAYS} from "@app/core/env"
import {isFeedLoading, makeFeed, makeFeedLoader} from "@app/features/feeds"
import type {FeedLoadState} from "@app/features/feeds"
import {notes} from "@app/features/social/notes"
import {isEventMuted} from "@app/features/social/muting"

// A like and a repost both name the note they answer, and both are drawn as that note.
export const DISCOVER_KINDS = [REACTION, REPOST, GENERIC_REPOST]

// NIP-25 has a reaction name its note last, as a repost does, and carries the note's author in a p tag.
export const getDiscoverRef = (event: TrustedEvent): Maybe<EventRef> => {
  const tags = event.tags.filter(tag => tag[0] === "e" && Boolean(tag[1]))
  const tag = tags[tags.length - 1]

  if (tag) {
    const pubkey = tagValue(tagSpec("p"), event.tags)

    return new EventRef({id: tag[1], pubkey, relays: getRelayHints(tag)})
  }
}

// One card in the discover feed: a note, and what the reader's follows did to it.
export type DiscoverEntry = {
  key: string
  ref: EventRef
  note?: TrustedEvent
  interactions: TrustedEvent[]
  pubkeys: string[]
  timestamp: number
}

// The notes the reader's follows liked or reposted, the ones most of them answered first.
export const groupDiscoverEvents = (events: TrustedEvent[]): DiscoverEntry[] => {
  const items = events.flatMap(event => {
    const ref = getDiscoverRef(event)

    if (!ref) {
      return []
    }

    const key = ref.getAddressOrId()

    return key ? [{key, ref, event}] : []
  })

  const entries = Array.from(
    groupBy(item => item.key, items),
    ([key, group]): DiscoverEntry => {
      const answered = group.map(({event}) => event)

      return {
        key,
        ref: group.map(({ref}) => ref).reduce(EventRef.merge),
        interactions: answered,
        pubkeys: uniqBy(event => event.pubkey, answered).map(event => event.pubkey),
        timestamp: Math.max(...answered.map(event => event.created_at)),
      }
    },
  )

  return entries.sort((a, b) => b.pubkeys.length - a.pubkeys.length || b.timestamp - a.timestamp)
}

// Two people are worth saying, and one person twice is still one person.
export const describeDiscoverEntry = (entry: DiscoverEntry) => {
  const count = entry.pubkeys.length
  const liked = entry.interactions.some(event => event.kind === REACTION)
  const reposted = entry.interactions.some(event => event.kind !== REACTION)
  const verb = liked && reposted ? "liked or reposted" : liked ? "liked" : "reposted"

  return count === 1
    ? `One person you follow ${verb} this`
    : `${count} people you follow ${verb} this`
}

/** Notes the reader's follows liked or reposted. The caller draws them and owns their context. */
export const makeDiscoverFeed = () => {
  const pages = writable<TrustedEvent[][]>([])
  const states = writable<FeedLoadState[]>([])
  const drawn = writable<string[]>([])
  const anchors = writable(new Map<string, Maybe<TrustedEvent>>())
  const unsubscribers: (() => void)[] = []
  const loaders: ReturnType<typeof makeFeedLoader>[] = []

  let admitting = false
  let stopped = false

  // A reader who muted someone is not told what that person liked, and a note they wrote is not drawn.
  const candidates = derived([pages, isEventMuted], ([$pages, $isEventMuted]) =>
    uniqBy(
      event => event.id,
      $pages.flat().filter(event => !$isEventMuted(event)),
    ),
  )

  const grouped = derived(candidates, groupDiscoverEvents)

  // What the feed holds and has not drawn, best liked first. An entry waits here for its note.
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
        .map(entry => ({...entry, note: $anchors.get(entry.key)}))
        .filter(entry => entry.note && !$isEventMuted(entry.note))
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

  // Every entry's note is in hand before it is drawn, so no card gains one above it afterwards.
  const admit = async () => {
    // Drawing waits on each entry's note, so the page grows too slowly to say when to fetch.
    if (get(buffer).length < 20) {
      loaders.forEach(loader => loader.run())
    }

    const batch = take(10, get(buffer))

    if (!admitting && batch.length > 0) {
      admitting = true

      try {
        // A note nobody can find would hold up every entry below it
        const deadline = sleep(6000).then(() => undefined)

        const loads = batch.map(async entry => {
          // Drawing waits on these, so they go out at the feed's own priority rather than behind its spans.
          const note =
            entry.note ??
            (await Promise.race([notes.get().load(entry.ref, {priority: 1}), deadline]))

          return [entry.key, note] as const
        })

        // Released in order, so an entry waits on what is above it and not on the whole batch.
        for (const load of loads) {
          const [key, note] = await load

          anchors.update($anchors => new Map($anchors).set(key, note))
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
      const feed = makeFeed({
        relays,
        // Half the group's relays answering is enough to show its page, since the rest get asked again.
        quorum: 0.5,
        useCache: false,
        filters: [{kinds: DISCOVER_KINDS, authors: pubkeys}],
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
