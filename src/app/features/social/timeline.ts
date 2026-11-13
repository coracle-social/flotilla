import {derived, get, writable} from "svelte/store"
import type {Readable} from "svelte/store"
import {call, chunks, initArray, noop, partition, shuffle} from "@welshman/lib"
import {outbox} from "@welshman/util"
import type {Filter, TrustedEvent} from "@welshman/util"
import {PLATFORM_RELAYS} from "@app/core/env"
import {relayLists, router} from "@app/core/plugins"
import {isFeedLoading, makeFeed, makeFeedLoader} from "@app/features/feeds"
import type {FeedLoadState} from "@app/features/feeds"

// What the follows published, paged one group of relays at a time so a slow group holds up no other.
export type Timeline = {
  events: Readable<TrustedEvent[]>
  loading: Readable<boolean>
  exhausted: Readable<boolean>
  // Fetch another page, once the feed has drawn what it has.
  page: () => Promise<unknown>
  settle: () => void
  stop: () => void
  start: (pubkeys: string[]) => Promise<void>
}

export const makeTimeline = ({
  getFilters,
  onEvent,
}: {
  getFilters: (pubkeys: string[]) => Filter[]
  onEvent?: (event: TrustedEvent) => void
}): Timeline => {
  const pages = writable<TrustedEvent[][]>([])
  const states = writable<FeedLoadState[]>([])
  const unsubscribers: (() => void)[] = []
  const loaders: ReturnType<typeof makeFeedLoader>[] = []

  let stopped = false

  const events = derived(pages, $pages => $pages.flat())

  const loading = derived(states, $states => $states.some(isFeedLoading))

  const exhausted = derived(
    states,
    $states => $states.length > 0 && $states.every(state => state.status === "exhausted"),
  )

  const page = () =>
    Promise.all(loaders.map(loader => loader.run().catch(error => console.error(error))))

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
        filters: getFilters(pubkeys),
        onEvent,
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

  const startGroups = (groups: string[][]) => {
    const offset = get(pages).length

    pages.update($pages => [...$pages, ...initArray(groups.length, () => [] as TrustedEvent[])])
    states.update($states => [
      ...$states,
      ...initArray(groups.length, (): FeedLoadState => ({status: "idle"})),
    ])

    return Promise.all(groups.map((group, index) => startGroup(group, offset + index)))
  }

  // One selection over every follow lands on the few biggest relays, so each group scores its own.
  const start = async (pubkeys: string[]) => {
    pages.set([])
    states.set([])

    if (PLATFORM_RELAYS.length > 0) {
      await startGroups(pubkeys.length > 0 ? [pubkeys] : [])
    } else {
      const [known, unknown] = partition(pubkey => Boolean(relayLists.get().get(pubkey)), pubkeys)

      await startGroups(chunks(3, shuffle(known)).filter(group => group.length > 0))

      // What can be asked for goes out now, while the rest look for a relay list to name.
      page()

      // Every follow asked in its own group once its relay list is in, rather than all on one set.
      await Promise.all(unknown.map(pubkey => relayLists.get().load(pubkey).catch(noop)))

      const loaded = unknown.filter(pubkey => relayLists.get().get(pubkey))

      await startGroups(chunks(3, shuffle(loaded)).filter(group => group.length > 0))
    }

    // A follow with no relays to ask means nothing to show, rather than a spinner that never stops.
    if (get(states).length === 0) {
      states.set([{status: "exhausted"}])
    }

    await page()
  }

  const stop = () => {
    stopped = true
    unsubscribers.forEach(call)
  }

  return {events, loading, exhausted, page, settle, stop, start}
}
