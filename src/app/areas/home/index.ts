import {MONTH, int} from "@welshman/lib"
import {hexTags, tagValues} from "@welshman/util"
import {registerRetention} from "@app/core/database"
import {registerSync} from "@app/core/sync"
import {ACTIVITY_KINDS, isNoteKind} from "@app/areas/home/activity/model"
import {syncActivity} from "@app/areas/home/activity/sync"

export * from "@app/areas/home/healthChecks"
export * from "@app/areas/home/activity/model"
export * from "@app/areas/home/activity/sync"
export * from "@app/areas/home/activity/stream"

export const registerHome = () => {
  registerSync(syncActivity)

  // The stream draws on your own notes as well as what was done to them, so neither waits on a relay.
  registerRetention({
    match: (event, pubkey) =>
      (ACTIVITY_KINDS.includes(event.kind) &&
        tagValues(hexTags("p"), event.tags).includes(pubkey)) ||
      (event.pubkey === pubkey && isNoteKind(event)),
    maxAge: int(1, MONTH),
  })
}
