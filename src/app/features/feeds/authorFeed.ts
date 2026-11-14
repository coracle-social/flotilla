import {derived, get, writable} from "svelte/store"
import type {Readable} from "svelte/store"
import {debounce} from "throttle-debounce"
import {chunks, partition, shuffle} from "@welshman/lib"
import {outbox} from "@welshman/util"
import type {Filter, TrustedEvent} from "@welshman/util"
import {combinePagers} from "@lib/pager"
import type {Pager} from "@lib/pager"
import {deriveEventsByIdForUrls} from "@lib/repository"
import {app} from "@app/core/app"
import {PLATFORM_RELAYS} from "@app/core/env"
import {relayLists, router} from "@app/core/plugins"
import {makeTimeline} from "@app/features/feeds/timeline"
import type {Timeline} from "@app/features/feeds/timeline"

export type AuthorFeedOptions = {
  pubkeys: Readable<string[]>
  getFilters: (authors: string[]) => Filter[]
  onEvent?: (event: TrustedEvent) => void
}

export type AuthorFeed = {events: Readable<TrustedEvent[]>; older: Pager; stop: () => void}

// One selection over every follow lands on the few biggest relays, so each group scores its own.
export const groupAuthors = (authors: string[]): string[][] =>
  chunks(3, shuffle(authors)).filter(group => group.length > 0)

export const makeAuthorFeed = ({pubkeys, getFilters, onEvent}: AuthorFeedOptions): AuthorFeed => {
  const groups = writable<Timeline[]>([])
  const built = writable(false)

  let controller = new AbortController()
  let started = false
  let lastKey: string | undefined

  const startGroup = async (authors: string[], signal: AbortSignal) => {
    const scenario = await router.get().resolve(authors.map(outbox))

    if (signal.aborted) {
      return
    }

    const urls = scenario.limit(10).getUrls()
    const filters = getFilters(authors)

    const group = makeTimeline({
      source: deriveEventsByIdForUrls({urls, filters, repository: app.get().repository}),
      relays: urls,
      filters,
      // Half a group's relays answering is enough to show its page; the rest are asked again next page.
      quorum: 0.5,
      // The cache would draw a group's history out of order.
      useCache: false,
      onEvent,
    })

    groups.update($groups => [...$groups, group])
  }

  const startGroups = async (groupsOfAuthors: string[][], signal: AbortSignal) => {
    await Promise.all(groupsOfAuthors.map(authors => startGroup(authors, signal)))
  }

  const events: Readable<TrustedEvent[]> = derived(groups, ($groups, set) => {
    if ($groups.length > 0) {
      const pages = $groups.map(group => group.events)

      return derived(pages, $pages => $pages.flat()).subscribe(set)
    }

    set([])
  })

  const combined = combinePagers(derived(groups, $groups => $groups.map(group => group.older)))

  // A follow list with no relays to ask means nothing to show, not a spinner that never stops.
  const status = derived([built, groups, combined.status], ([$built, $groups, $status]) =>
    $built && $groups.length === 0 ? "exhausted" : $status,
  )

  const older: Pager = {status, page: combined.page, settle: combined.settle}

  const reset = () => {
    controller.abort()
    get(groups).forEach(group => group.stop())
    groups.set([])
    built.set(false)
  }

  const hasRelayList = (pubkey: string) => Boolean(relayLists.get().get(pubkey))

  const build = async (authors: string[]) => {
    controller.abort()
    controller = new AbortController()

    const {signal} = controller

    if (PLATFORM_RELAYS.length > 0) {
      await startGroup(authors, signal)

      if (signal.aborted) {
        return
      }
    } else {
      const [known, unknown] = partition(hasRelayList, authors)

      await startGroups(groupAuthors(known), signal)

      if (signal.aborted) {
        return
      }

      // Known groups ask while the rest look for a relay list.
      older.page()

      await Promise.all(
        unknown.map(pubkey =>
          relayLists
            .get()
            .load(pubkey)
            .catch(error => console.error(error)),
        ),
      )

      if (signal.aborted) {
        return
      }

      await startGroups(groupAuthors(unknown.filter(hasRelayList)), signal)

      if (signal.aborted) {
        return
      }
    }

    built.set(true)

    await older.page()
  }

  // A burst of follows lands on one rebuild.
  const rebuild = debounce(1000, (authors: string[]) => {
    reset()
    build(authors)
  })

  const stopPubkeys = pubkeys.subscribe($pubkeys => {
    const key = $pubkeys.join(",")

    if (key !== lastKey) {
      lastKey = key

      if ($pubkeys.length === 0) {
        rebuild.cancel()
        reset()
        started = false
      } else if (started) {
        rebuild($pubkeys)
      } else {
        started = true
        build($pubkeys)
      }
    }
  })

  const stop = () => {
    rebuild.cancel()
    stopPubkeys()
    reset()
  }

  return {events, older, stop}
}
