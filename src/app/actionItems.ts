import {derived} from "svelte/store"
import {REPORT, sortEventsDesc} from "@welshman/util"
import {events, rooms} from "@app/core"
import {deriveSpacePermissions} from "@app/management"

// Action items (admin review queue)

// A report is resolved by banning the event it names, a join request by allowing the pubkey.
export const deriveSpaceActionItems = (url: string) =>
  derived(
    [
      events.get().forUrl(url, [{kinds: [REPORT]}]).$,
      rooms.get().pendingJoins(url).$,
      deriveSpacePermissions(url),
    ],
    ([$reports, $pendingJoins, $permissions]) =>
      sortEventsDesc([
        ...($permissions.deleteContent ? $reports : []),
        ...($permissions.addMembers ? $pendingJoins : []),
      ]),
  )
