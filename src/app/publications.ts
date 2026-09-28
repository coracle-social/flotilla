import {derived} from "svelte/store"
import {pushToMapKey} from "@welshman/lib"
import {Publisher} from "@welshman/app"
import type {Publication} from "@welshman/app"
import {fromApp} from "@app/core"

let previous = new Map<string, Publication[]>()

// Indexed once, since each row filtering the whole history is O(rows x history) per publish.
export const publicationsByEventId = derived(
  fromApp($app => $app.use(Publisher).history),
  $history => {
    const byId = new Map<string, Publication[]>()

    for (const publication of $history) {
      pushToMapKey(byId, publication.event.id, publication)
    }

    // Hand back last time's array where an event's publications are unchanged, so the merge below is stable.
    for (const [id, publications] of byId) {
      const before = previous.get(id)

      if (before?.length === publications.length && before.every((p, i) => p === publications[i])) {
        byId.set(id, before)
      }
    }

    previous = byId

    return byId
  },
  new Map<string, Publication[]>(),
)

// Shared, so a row with nothing in flight keeps the same value across every publish.
export const noPublications: Publication[] = []
