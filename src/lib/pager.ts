import {derived, get, readonly, writable} from "svelte/store"
import type {Readable} from "svelte/store"
import {ms, sleep} from "@welshman/lib"
import {createScroller} from "@lib/html"

export type PagerStatus = "idle" | "loading" | "exhausted"

// A window is complete once its relay has sent everything in it, and an incomplete one to retry was refused only for now
export type PageResult = {
  found: number
  complete: boolean
  retry?: boolean
  exhausted: boolean
  behind: boolean
}

export type Pager = {
  status: Readable<PagerStatus>
  page: () => Promise<void>
  settle: () => Promise<void>
}

export type PagerOptions = {
  load: () => Promise<PageResult>
  // Called when a window ends incomplete and the pager stops, so a feed can replace its relay
  onDrop?: () => void
}

export const makePager = ({load, onDrop}: PagerOptions): Pager => {
  const status = writable<PagerStatus>("idle")

  let running = false
  // Before any window is complete a feed is behind by definition.
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

        if (!result.complete) {
          if (result.retry) {
            await sleep(ms(3))
          } else {
            // A relay that couldn't complete a window is dropped rather than asked again forever
            status.set("exhausted")
            onDrop?.()
          }

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

export type Window = {since: number; until: number}

export type WindowResult = {found: number; complete: boolean; retry?: boolean}

// A direction through time: where it starts, when it's done, the next window, and where a complete window leaves it.
export type Walk<C, R extends WindowResult> = {
  start: C
  isDone: (cursor: C) => boolean
  getWindow: (cursor: C) => Window
  advance: (cursor: C, window: Window, result: R) => C
}

export type WalkPagerOptions<C, R extends WindowResult> = {
  walk: Walk<C, R>
  request: (window: Window) => Promise<R>
  isBehind?: (cursor: C) => boolean
  onDrop?: () => void
}

// Asks for one window per load, and moves the cursor once a window is complete.
export const makeWalkPager = <C, R extends WindowResult>({
  walk,
  request,
  isBehind = () => false,
  onDrop,
}: WalkPagerOptions<C, R>) => {
  const cursor = writable(walk.start)

  const load = async (): Promise<PageResult> => {
    const current = get(cursor)

    if (walk.isDone(current)) {
      return {found: 0, complete: true, exhausted: true, behind: false}
    }

    const window = walk.getWindow(current)
    const result = await request(window)

    if (result.complete) {
      cursor.set(walk.advance(current, window, result))
    }

    return {
      found: result.found,
      complete: result.complete,
      retry: result.retry,
      exhausted: false,
      behind: isBehind(get(cursor)),
    }
  }

  return {...makePager({load, onDrop}), cursor: readonly(cursor)}
}

const combineStatuses = (statuses: PagerStatus[]): PagerStatus => {
  if (statuses.includes("loading")) {
    return "loading"
  }

  if (statuses.every(status => status === "exhausted")) {
    return "exhausted"
  }

  return "idle"
}

export const combinePagers = (pagers: Readable<Pager[]>): Pager => {
  const status: Readable<PagerStatus> = derived(pagers, ($pagers, set) => {
    if ($pagers.length > 0) {
      const statuses = $pagers.map(pager => pager.status)

      return derived(statuses, combineStatuses).subscribe(set)
    }

    set("idle")
  })

  const page = async () => {
    await Promise.all(get(pagers).map(pager => pager.page().catch(error => console.error(error))))
  }

  const settle = async () => {
    await Promise.all(get(pagers).map(pager => pager.settle().catch(error => console.error(error))))
  }

  return {status, page, settle}
}

type FollowScrollOptions = {reverse?: boolean; threshold?: number}

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
