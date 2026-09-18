import {derived} from "svelte/store"
import {REPORT, sortEventsDesc} from "@welshman/util"
import {rooms} from "@app/core"
import {deriveSpaceSupportedMethods} from "@app/management"
import {deriveEventsForUrl} from "@app/repository"

// Action items (admin review queue)

// A report is resolved by banning the event it names, a join request by allowing the pubkey, so
// the queue holds whichever of the two the user can actually act on.
export const deriveSpaceActionItems = (url: string) =>
  derived(
    [
      deriveEventsForUrl(url, [{kinds: [REPORT]}]),
      rooms.get().pendingJoins(url).$,
      deriveSpaceSupportedMethods(url),
    ],
    ([$reports, $pendingJoins, $methods]) =>
      sortEventsDesc([
        ...($methods.includes("banevent") ? $reports : []),
        ...($methods.includes("allowpubkey") ? $pendingJoins : []),
      ]),
  )
