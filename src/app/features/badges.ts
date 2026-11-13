import {writable} from "svelte/store"
import {Badge} from "@capawesome/capacitor-badge"
import {merged} from "@welshman/store"
import {alertSettings} from "@app/features/alerts"
import {unreadCount} from "@app/features/activity"

// Firefox and most desktops can't draw an icon badge, and the plugin has no other way to say so.
export const badgesSupported = writable(false)

Badge.isSupported().then(({isSupported}) => badgesSupported.set(isSupported))

const setBadge = async (count?: number) => {
  try {
    if (count === undefined) {
      await Badge.clear()
    } else {
      await Badge.set({count})
    }
  } catch {
    // pass - the plugin rejects on platforms without icon badges
  }
}

export const syncBadges = () => {
  let shown: number | undefined

  return merged([unreadCount, alertSettings]).subscribe(([count, {badge}]) => {
    const next = badge ? count : undefined

    if (next !== shown) {
      shown = next
      setBadge(next)
    }
  })
}
