import {derived} from "svelte/store"
import {REPORT, sortEventsDesc} from "@welshman/util"
import {rooms} from "@app/core"
import {deriveSpacePermissions} from "@app/management"
import {deriveEventsForUrl} from "@app/repository"

// Action items (admin review queue)

// A report is resolved by banning the event it names, a join request by allowing the pubkey.
export const deriveSpaceActionItems = (url: string) =>
  derived(
    [
      deriveEventsForUrl(url, [{kinds: [REPORT]}]),
      rooms.get().pendingJoins(url).$,
      deriveSpacePermissions(url),
    ],
    ([$reports, $pendingJoins, $permissions]) =>
      sortEventsDesc([
        ...($permissions.deleteContent ? $reports : []),
        ...($permissions.addMembers ? $pendingJoins : []),
      ]),
  )
