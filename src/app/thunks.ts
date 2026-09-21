import {derived} from "svelte/store"
import {pushToMapKey} from "@welshman/lib"
import {Thunks} from "@welshman/app"
import type {Thunk} from "@welshman/app"
import {fromApp} from "@app/core"

let previous = new Map<string, Thunk[]>()

// Publishes indexed by the event they carry.
//
// Every row that shows publish status wants the thunks for one event, and each of them filtering
// the whole history is O(rows × history) on every publish — history only shrinks when a thunk is
// aborted, so it grows for as long as the session lasts. Indexing once leaves each row a lookup.
export const thunksByEventId = derived(
  fromApp($app => $app.use(Thunks).history),
  $history => {
    const byId = new Map<string, Thunk[]>()

    for (const thunk of $history) {
      pushToMapKey(byId, thunk.options.event.id, thunk)
    }

    // Hand back the array from last time wherever an event's thunks are unchanged. A row derives
    // a merged thunk from this, and that merge subscribes to each thunk it holds — rebuilding it
    // every time anything anywhere publishes churns the object its status components are watching.
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

// Shared, so a row with nothing in flight keeps the same value across every publish and doesn't
// rebuild anything downstream
export const noThunks: Thunk[] = []
