import {derived, get, writable} from "svelte/store"
import type {Readable} from "svelte/store"
import {ms, sleep} from "@welshman/lib"
import {createScroller} from "@lib/html"

export type PagerStatus = "idle" | "loading" | "exhausted"

export type PageResult = {found: number; answered: boolean; exhausted: boolean; behind: boolean}

export type Pager = {
  status: Readable<PagerStatus>
  page: () => Promise<void>
  settle: () => Promise<void>
}

export const makePager = (load: () => Promise<PageResult>): Pager => {
  const status = writable<PagerStatus>("idle")

  let running = false
  // Before any window is answered a feed is behind by definition.
  let behind = true

  const page = async () => {
    if (running || get(status) === "exhausted") {
      return
    }

    running = true

    try {
      for (let i = 0; i < 3; i++) {
        status.set("loading")

        const result = await load()

        behind = result.behind

        if (result.exhausted) {
          status.set("exhausted")
          return
        }

        if (!result.answered) {
          await sleep(ms(3))
          return
        }

        if (result.found > 0) {
          return
        }
      }
    } finally {
      running = false
    }
  }

  const settle = async () => {
    if (behind) {
      await page()
    } else if (!running && get(status) === "loading") {
      status.set("idle")
    }
  }

  return {status, page, settle}
}

const combineStatuses = (statuses: PagerStatus[]): PagerStatus => {
  if (statuses.includes("loading")) {
    return "loading"
  }

  if (statuses.length > 0 && statuses.every(status => status === "exhausted")) {
    return "exhausted"
  }

  return "idle"
}

export const combinePagers = (pagers: Readable<Pager[]>): Pager => {
  const status: Readable<PagerStatus> = derived(pagers, ($pagers, set) => {
    if ($pagers.length === 0) {
      set("idle")
    } else {
      const statuses = $pagers.map(pager => pager.status)

      return derived(statuses, combineStatuses).subscribe(set)
    }
  })

  const page = async () => {
    await Promise.all(get(pagers).map(pager => pager.page().catch(error => console.error(error))))
  }

  const settle = async () => {
    await Promise.all(get(pagers).map(pager => pager.settle().catch(error => console.error(error))))
  }

  return {status, page, settle}
}

export type FollowScrollOptions = {reverse?: boolean; threshold?: number}

export const followScroll = (
  element: HTMLElement,
  pager: Pager,
  {reverse = false, threshold = 5000}: FollowScrollOptions = {},
) =>
  createScroller({
    element,
    delay: 300,
    reverse,
    threshold,
    onScroll: pager.page,
    onSettle: pager.settle,
  }).stop
