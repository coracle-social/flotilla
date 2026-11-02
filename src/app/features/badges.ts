import {derived} from "svelte/store"
import {Badge} from "@capawesome/capacitor-badge"
import {identity} from "@welshman/lib"
import {notificationSettings} from "@app/features/push/adapters/common"
import {notificationCount} from "@app/features/notifications"

export const syncBadges = () =>
  derived([notificationCount, notificationSettings], identity).subscribe(
    async ([count, $notificationSettings]) => {
      if ($notificationSettings.badge) {
        try {
          await Badge.set({count})
        } catch (err) {
          // pass - firefox doesn't support badges
        }
      } else {
        await clearBadges()
      }
    },
  )

export const clearBadges = async () => {
  try {
    await Badge.clear()
  } catch (e) {
    // pass - firefox doesn't support this
  }
}
