import {derived} from "svelte/store"
import {pushToMapKey} from "@welshman/lib"
import {Thunks} from "@welshman/app"
import type {Thunk} from "@welshman/app"
import {fromApp} from "@app/core"

let previous = new Map<string, Thunk[]>()

// Indexed once, since each row filtering the whole history is O(rows x history) per publish.
export const thunksByEventId = derived(
  fromApp($app => $app.use(Thunks).history),
  $history => {
    const byId = new Map<string, Thunk[]>()

    for (const thunk of $history) {
      pushToMapKey(byId, thunk.options.event.id, thunk)
    }

    // Hand back last time's array where an event's thunks are unchanged, so the merge below is stable.
    for (const [id, thunks] of byId) {
      const before = previous.get(id)

      if (before?.length === thunks.length && before.every((thunk, i) => thunk === thunks[i])) {
        byId.set(id, before)
      }
    }

    previous = byId

    return byId
  },
  new Map<string, Thunk[]>(),
)

// Shared, so a row with nothing in flight keeps the same value across every publish.
export const noThunks: Thunk[] = []
