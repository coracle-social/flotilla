import {derived, get, readable, writable} from "svelte/store"
import type {Readable} from "svelte/store"
import {
  call,
  chunks,
  countBy,
  first,
  groupBy,
  indexBy,
  min,
  partition,
  removeUndefined,
  shuffle,
  sortBy,
  take,
  uniqBy,
} from "@welshman/lib"
import type {Maybe} from "@welshman/lib"
import {EventRef, NOTE, getIdOrAddress, outbox} from "@welshman/util"
import type {TrustedEvent} from "@welshman/util"
import {synced} from "@welshman/store"
import {Note} from "@welshman/domain"
import {createScroller} from "@lib/html"
import {router} from "@app/core/plugins"
import {reader} from "@app/core/domain"
import {kv} from "@app/core/storage"
import {PLATFORM_RELAYS} from "@app/core/env"
import {CONTENT_KINDS} from "@app/features/spaces"
import {isFeedLoading, makeFeed, makeFeedLoader} from "@app/features/feeds"
import type {FeedContext, FeedLoadState} from "@app/features/feeds"
import {getReplyRefs} from "@app/features/social/replies"
import {notes} from "@app/features/social/notes"
import {isEventMuted} from "@app/features/social/muting"

// What the feed can be narrowed to, with both types included until the reader says otherwise.
export const networkFeedTypes = [
  {value: "notes", label: "Notes"},
  {value: "replies", label: "Replies"},
] as const

export type NetworkFeedType = (typeof networkFeedTypes)[number]["value"]

export const includedNetworkFeedTypes = synced<NetworkFeedType[]>({
  key: "includedNetworkFeedTypes",
  defaultValue: networkFeedTypes.map(({value}) => value),
  storage: kv,
})

// Only a kind 1 carries NIP-10 reply tags, so an article or a poll in the feed is a note.
const networkFeedType = (event: TrustedEvent): NetworkFeedType =>
  event.kind === NOTE && reader(Note)(event).parent() ? "replies" : "notes"

export const isIncludedNetworkFeedEvent = derived(
  includedNetworkFeedTypes,
  $included => (event: TrustedEvent) => $included.includes(networkFeedType(event)),
)

export const countNetworkFeedTypes = (events: TrustedEvent[]) => countBy(networkFeedType, events)

// One card in the network feed: the note it is drawn around, and the replies answering it.
export type NetworkFeedEntry = {
  key: string
  ref: EventRef
  note?: TrustedEvent
  replies: TrustedEvent[]
}

// What a feed event is drawn under: the note a reply answers, or the event itself.
const getNetworkFeedRef = (event: TrustedEvent) => {
  const answered = networkFeedType(event) === "replies" ? getReplyRefs(event).parent : undefined

  return answered ?? EventRef.fromEvent(event)
}

// Where an entry sits in the feed: its note, or the oldest reply when the note is not loaded.
const getNetworkFeedTimestamp = (entry: NetworkFeedEntry) =>
  entry.note?.created_at ?? min(entry.replies.map(reply => reply.created_at))

// A reply collapses into the entry for the note it answers, so two replies to one note share it.
export const groupNetworkFeedEvents = (events: TrustedEvent[]): NetworkFeedEntry[] => {
  const items = events.flatMap(event => {
    const ref = getNetworkFeedRef(event)
    const key = ref.getAddressOrId()

    return key ? [{key, ref, event}] : []
  })

  const entries = Array.from(
    groupBy(item => item.key, items),
    ([key, group]): NetworkFeedEntry => {
      const [anchors, replies] = partition(({ref, event}) => ref.id === event.id, group)

      return {
        key,
        ref: group.map(({ref}) => ref).reduce(EventRef.merge),
        note: first(anchors)?.event,
        replies: replies.map(({event}) => event),
      }
    },
  )

  return sortBy(entry => -getNetworkFeedTimestamp(entry), entries)
}

export type NetworkFeedOptions = {
  context: FeedContext
  isIncluded?: Readable<(event: TrustedEvent) => boolean>
  pinned?: Readable<TrustedEvent[]>
  sortByTime?: boolean
}

/** Notes with each reply drawn under the note it answers. The caller owns the context. */
export const makeNetworkFeed = ({
  context,
  isIncluded = readable(() => true),
  pinned = readable<TrustedEvent[]>([]),
  sortByTime = false,
}: NetworkFeedOptions) => {
  const pages = writable<TrustedEvent[][]>([])
  const states = writable<FeedLoadState[]>([])
  const drawn = writable<string[]>([])
  const anchors = writable(new Map<string, Maybe<TrustedEvent>>())
  const unsubscribers: (() => void)[] = []
  const loaders: ReturnType<typeof makeFeedLoader>[] = []

  let admitting = false
  let stopped = false

  const pinnedFirst = derived(pinned, $pinned => {
    const keys = new Set($pinned.map(getIdOrAddress))

    return (entry: NetworkFeedEntry) => (keys.has(entry.key) ? 0 : 1)
  })

  // Everything the feed holds, newest first, less whoever the reader muted.
  const candidates = derived([pages, pinned, isEventMuted], ([$pages, $pinned, $isEventMuted]) =>
    uniqBy(
      getIdOrAddress,
      sortBy(
        event => -event.created_at,
        // A pinned note can be older than the feed has paged back to, so it is merged in.
        [...$pinned, ...$pages.flat()].filter(event => !$isEventMuted(event)),
      ),
    ),
  )

  const items = derived([candidates, isIncluded], ([$candidates, $isIncluded]) =>
    $candidates.filter($isIncluded),
  )

  const grouped = derived([items, pinnedFirst], ([$items, $pinnedFirst]) =>
    sortBy($pinnedFirst, groupNetworkFeedEvents($items)),
  )

  // What the feed holds and has not drawn, newest first. An entry waits here for its note.
  const buffer = derived([grouped, anchors], ([$grouped, $anchors]) =>
    $grouped.filter(entry => !$anchors.has(entry.key)),
  )

  const entries = derived([grouped, drawn, anchors], ([$grouped, $drawn, $anchors]) => {
    const drawnKeys = new Set($drawn)
    const byKey = indexBy(entry => entry.key, $grouped)
    // Merged timelines page at their own rates, so time order would move entries already drawn.
    const ordered = sortByTime
      ? $grouped.filter(entry => drawnKeys.has(entry.key))
      : removeUndefined($drawn.map(key => byKey.get(key)))

    return ordered.map(entry => ({
      ...entry,
      // A note the feed carries itself still belongs on its card when the load missed it.
      note: $anchors.get(entry.key) ?? entry.note,
    }))
  })

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
        const loads = batch.map(async entry => {
          // Drawing waits on these, so they go out at the feed's own priority rather than behind its spans.
          const note =
            entry.note ?? (await notes.get().load(entry.ref, {replies: entry.replies, priority: 1}))

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
        filters: [{kinds: [NOTE, ...CONTENT_KINDS], authors: pubkeys}],
        onEvent: context.add,
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
    const groups =
      PLATFORM_RELAYS.length > 0
        ? [pubkeys]
        : chunks(3, shuffle(pubkeys)).filter(group => group.length > 0)
    const scroller = createScroller({element, delay: 300, onScroll: admit, onSettle: settle})

    pages.set(groups.map(() => []))
    states.set(groups.map(() => ({status: "idle"})))
    groups.forEach(startGroup)
    unsubscribers.push(scroller.stop)
  }

  const stop = () => {
    stopped = true
    unsubscribers.forEach(call)
  }

  return {candidates, items, entries, loading, exhausted, start, stop}
}
