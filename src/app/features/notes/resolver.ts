import {get, writable} from "svelte/store"
import type {Readable} from "svelte/store"
import {removeUndefined} from "@welshman/lib"
import type {Maybe} from "@welshman/lib"
import type {TrustedEvent} from "@welshman/util"
import {notes} from "@app/features/notes/notes"
import type {NoteRequest} from "@app/features/notes/notes"

/** Loads the notes a list names but lacks; one it gives up on is `undefined` in `notes`. */
export type NoteResolver = {
  notes: Readable<Map<string, Maybe<TrustedEvent>>>
  resolve: (requests: NoteRequest[]) => void
  stop: () => void
}

/** Loads queued notes in batches, giving up on each after `maxAttempts` loads miss it. */
export const makeNoteResolver = ({
  batchSize = 10,
  maxAttempts = 1,
  timeout,
  priority,
}: {
  batchSize?: number
  maxAttempts?: number
  timeout?: number
  priority?: number
} = {}): NoteResolver => {
  const resolved = writable(new Map<string, Maybe<TrustedEvent>>())
  const queue: NoteRequest[] = []
  const pending = new Set<string>()
  const attempts = new Map<string, number>()
  const controller = new AbortController()
  let running = false

  // Records what a batch found, and gives up on a missing note once it has used its attempts.
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

  // Drains the queue a batch at a time, and `running` keeps a second loop from starting.
  const loop = async () => {
    running = true

    try {
      while (queue.length > 0 && !controller.signal.aborted) {
        const batch = queue.splice(0, batchSize)

        let found: Map<string, TrustedEvent>

        try {
          found = await notes.get().loadMany(batch, {signal: controller.signal, timeout, priority})
        } catch (error) {
          if (!controller.signal.aborted) {
            console.error(error)
          }

          found = new Map()
        }

        const keys = removeUndefined(batch.map(request => request.ref.getAddressOrId()))

        for (const key of keys) {
          pending.delete(key)
        }

        settle(batch, found)
      }
    } finally {
      running = false
    }
  }

  // Queues each note not already settled or waiting, and starts the loop if it's idle.
  const resolve = (requests: NoteRequest[]) => {
    const settled = get(resolved)

    for (const request of requests) {
      const key = request.ref.getAddressOrId()

      if (key && !settled.has(key) && !pending.has(key)) {
        queue.push(request)
        pending.add(key)
      }
    }

    if (!running) {
      loop()
    }
  }

  const stop = () => controller.abort()

  return {notes: resolved, resolve, stop}
}
