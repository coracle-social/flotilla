import {get, writable} from "svelte/store"
import type {Readable} from "svelte/store"
import {removeUndefined} from "@welshman/lib"
import type {Maybe} from "@welshman/lib"
import type {TrustedEvent} from "@welshman/util"
import {notes} from "@app/features/social/notes"
import type {NoteRequest} from "@app/features/social/notes"

export type NoteResolverOptions = {
  batchSize?: number
  maxAttempts?: number
  timeout?: number
  priority?: number
}

export type NoteResolver = {
  notes: Readable<Map<string, Maybe<TrustedEvent>>>
  resolve: (requests: NoteRequest[]) => void
  stop: () => void
}

export const makeNoteResolver = ({
  batchSize = 10,
  maxAttempts = 1,
  timeout,
  priority,
}: NoteResolverOptions = {}): NoteResolver => {
  const resolved = writable(new Map<string, Maybe<TrustedEvent>>())
  const queue: NoteRequest[] = []
  const inFlight = new Set<string>()
  const attempts = new Map<string, number>()
  const controller = new AbortController()
  let running = false

  const settle = (batch: NoteRequest[], found: Map<string, TrustedEvent>) => {
    resolved.update(current => {
      const next = new Map(current)

      for (const request of batch) {
        const key = request.ref.getAddressOrId()

        if (key) {
          const note = found.get(key)

          if (note) {
            next.set(key, note)
          } else {
            const count = (attempts.get(key) ?? 0) + 1

            attempts.set(key, count)

            if (count >= maxAttempts) {
              next.set(key, undefined)
            }
          }
        }
      }

      return next
    })
  }

  const loop = async () => {
    running = true

    try {
      while (queue.length > 0 && !controller.signal.aborted) {
        const batch = queue.splice(0, batchSize)
        const keys = removeUndefined(batch.map(request => request.ref.getAddressOrId()))

        for (const key of keys) {
          inFlight.add(key)
        }

        let found: Map<string, TrustedEvent>

        try {
          found = await notes.get().loadMany(batch, {signal: controller.signal, timeout, priority})
        } catch (error) {
          if (!controller.signal.aborted) {
            console.error(error)
          }

          found = new Map()
        }

        for (const key of keys) {
          inFlight.delete(key)
        }

        settle(batch, found)
      }
    } finally {
      running = false
    }
  }

  const resolve = (requests: NoteRequest[]) => {
    const settled = get(resolved)
    const queued = new Set(removeUndefined(queue.map(request => request.ref.getAddressOrId())))

    for (const request of requests) {
      const key = request.ref.getAddressOrId()

      if (key && !settled.has(key) && !queued.has(key) && !inFlight.has(key)) {
        queue.push(request)
        queued.add(key)
      }
    }

    if (!running) {
      loop()
    }
  }

  const stop = () => controller.abort()

  return {notes: {subscribe: resolved.subscribe}, resolve, stop}
}
