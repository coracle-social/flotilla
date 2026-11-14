import {MONTH, int} from "@welshman/lib"
import {hexTags, tagValues} from "@welshman/util"
import {registerRetention} from "@app/core/database"
import {registerSync} from "@app/core/sync"
import {NOTIFICATION_KINDS, isNotificationTarget} from "@app/features/notifications/model"
import {syncNotifications} from "@app/features/notifications/sync"

export * from "@app/features/notifications/model"
export * from "@app/features/notifications/sync"
export * from "@app/features/notifications/stream"

export const registerNotifications = () => {
  registerSync(syncNotifications)

  // The stream draws on your own notes as well as what was done to them, so neither waits on a relay.
  registerRetention({
    match: (event, pubkey) =>
      (NOTIFICATION_KINDS.includes(event.kind) &&
        tagValues(hexTags("p"), event.tags).includes(pubkey)) ||
      (event.pubkey === pubkey && isNotificationTarget(event)),
    maxAge: int(1, MONTH),
  })
}
