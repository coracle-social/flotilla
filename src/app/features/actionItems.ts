import {derived} from "svelte/store"
import {REPORT, sortEventsDesc} from "@welshman/util"
import {Events, Rooms} from "@welshman/app"
import {fromApp} from "@app/core/app"
import {deriveSpacePermissions} from "@app/core/management"

// Action items (admin review queue)

// A report is resolved by banning the event it names, a join request by allowing the pubkey.
export const deriveSpaceActionItems = (url: string) =>
  derived(
    [
      fromApp($app => $app.use(Events).forUrl(url, [{kinds: [REPORT]}]).$),
      fromApp($app => $app.use(Rooms).pendingJoins(url).$),
      deriveSpacePermissions(url),
    ],
    ([$reports, $pendingJoins, $permissions]) =>
      sortEventsDesc([
        ...($permissions.deleteContent ? $reports : []),
        ...($permissions.addMembers ? $pendingJoins : []),
      ]),
  )
