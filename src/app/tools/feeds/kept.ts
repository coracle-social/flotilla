import {readonly, writable} from "svelte/store"
import {on} from "@welshman/lib"
import {throttled} from "@welshman/store"
import type {AsyncProjection, EventsById, RepositoryUpdate} from "@welshman/store"
import {app} from "@app/core/app"

// A relay that refuses a publish drops the event from the source, but it stays listed with its failure until the repository removes it.
export const keepEvents = (source: AsyncProjection<EventsById>) => {
  const kept: EventsById = new Map()
  const events = writable(kept)

  // A page lands as a burst of events, which redraws the feed once rather than once per event
  const stopSource = throttled(150, source.$).subscribe($events => {
    const before = kept.size

    for (const [id, event] of $events) {
      kept.set(id, event)
    }

    if (kept.size > before) {
      events.set(kept)
    }
  })

  const stopRemovals = on(app.get().repository, "update", ({removed}: RepositoryUpdate) => {
    const before = kept.size

    for (const id of removed) {
      kept.delete(id)
    }

    if (kept.size < before) {
      events.set(kept)
    }
  })

  const stop = () => {
    stopSource()
    stopRemovals()
  }

  return {events: readonly(events), stop}
}
