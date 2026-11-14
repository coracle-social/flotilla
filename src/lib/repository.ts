import {batch, call, omit, on} from "@welshman/lib"
import type {Maybe} from "@welshman/lib"
import type {Filter, TrustedEvent} from "@welshman/util"
import {projection, readable} from "@welshman/store"
import type {AsyncProjection, EventsById, Repository, RepositoryUpdate} from "@welshman/store"

export type EventsByIdForUrlsOptions = {urls: string[]; filters: Filter[]; repository: Repository}

const onLookUpError = (error: unknown) =>
  console.error("Failed to look up events seen on the relays", error)

// The filters narrowed to `ids` and unlimited, so the limit counts only what is asked for
const narrowFilters = (filters: Filter[], ids: string[]) =>
  filters.map(filter => ({
    ...omit(["limit"], filter),
    ids: filter.ids ? filter.ids.filter(id => ids.includes(id)) : ids,
  }))

export const deriveEventsByIdForUrls = ({
  urls,
  filters,
  repository,
}: EventsByIdForUrlsOptions): AsyncProjection<EventsById> => {
  const {tracker} = repository
  const eventsById: EventsById = new Map()

  const isOnUrls = (id: string) => urls.some(url => tracker.hasRelay(id, url))

  const load = async (): Promise<EventsById> => {
    const events = await repository.query(filters)
    const loaded: EventsById = new Map()

    for (const event of events) {
      if (isOnUrls(event.id)) {
        loaded.set(event.id, event)
      }
    }

    return loaded
  }

  const $ = readable<EventsById>(eventsById, set => {
    // Ids seen on the urls while the read is in flight, which the read may well answer itself
    let seenWhileReading: Maybe<Set<string>>
    let stopped = false

    const replace = (events: TrustedEvent[]) => {
      eventsById.clear()

      for (const event of events) {
        if (isOnUrls(event.id)) {
          eventsById.set(event.id, event)
        }
      }

      set(eventsById)
    }

    const update = ({added, removed}: RepositoryUpdate) => {
      let dirty = false

      for (const event of added) {
        if (isOnUrls(event.id)) {
          eventsById.set(event.id, event)
          dirty = true
        }
      }

      for (const id of removed) {
        dirty = eventsById.delete(id) || dirty
      }

      if (dirty) {
        set(eventsById)
      }
    }

    const lookUp = async (ids: string[]) => {
      let events: TrustedEvent[]

      try {
        events = await repository.query(narrowFilters(filters, ids))
      } catch (error) {
        onLookUpError(error)
        return
      }

      let dirty = false

      for (const event of events) {
        if (!stopped && isOnUrls(event.id) && !eventsById.has(event.id)) {
          eventsById.set(event.id, event)
          dirty = true
        }
      }

      if (dirty) {
        set(eventsById)
      }
    }

    const check = batch(100, (ids: string[]) => {
      if (!stopped) {
        lookUp(ids)
      }
    })

    const observe = () => {
      seenWhileReading = new Set()

      return repository.observe({
        filters,
        onUpdate: update,
        onLoad: events => {
          const seen = seenWhileReading ?? new Set<string>()

          seenWhileReading = undefined
          replace(events)

          for (const id of seen) {
            if (!eventsById.has(id)) {
              check(id)
            }
          }
        },
      })
    }

    let stop = observe()

    const reset = () => {
      stop()
      stop = observe()
    }

    const unsubscribers = [
      on(tracker, "add", (id: string, trackedUrl: string) => {
        if (urls.includes(trackedUrl) && !eventsById.has(id)) {
          if (seenWhileReading) {
            seenWhileReading.add(id)
          } else {
            check(id)
          }
        }
      }),
      on(tracker, "remove", (id: string, trackedUrl: string) => {
        if (urls.includes(trackedUrl) && !isOnUrls(id) && eventsById.delete(id)) {
          set(eventsById)
        }
      }),
      on(tracker, "load", reset),
      on(tracker, "clear", reset),
    ]

    return () => {
      stopped = true
      stop()
      unsubscribers.forEach(call)
    }
  })

  return {...projection($, () => eventsById), load}
}
