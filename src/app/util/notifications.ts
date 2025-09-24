import {derived, get} from "svelte/store"
import {synced, throttled} from "@welshman/store"
import {pubkey, relaysByUrl} from "@welshman/app"
import {prop, spec, identity, now, groupBy} from "@welshman/lib"
import type {TrustedEvent} from "@welshman/util"
import {EVENT_TIME, MESSAGE, THREAD, COMMENT, getTagValue} from "@welshman/util"
import {
  makeSpacePath,
  makeChatPath,
  makeThreadPath,
  makeCalendarPath,
  makeSpaceChatPath,
  makeRoomPath,
} from "@app/util/routes"
import {
  chats,
  hasNip29,
  getUrlsForEvent,
  userRoomsByUrl,
  repositoryStore,
  userSettingsValues,
} from "@app/core/state"
import {preferencesStorageProvider} from "@src/lib/storage"
import {Badge} from "@capawesome/capacitor-badge"

// Checked state

export const checked = synced<Record<string, number>>({
  key: "checked",
  defaultValue: {},
  storage: preferencesStorageProvider,
})

export const deriveChecked = (key: string) => derived(checked, prop(key))

export const setChecked = (key: string) => checked.update(state => ({...state, [key]: now()}))

// Derived notifications state

export const notifications = derived(
  throttled(
    1000,
    derived(
      [pubkey, checked, chats, userRoomsByUrl, repositoryStore, getUrlsForEvent, relaysByUrl],
      identity,
    ),
  ),
  ([$pubkey, $checked, $chats, $userRoomsByUrl, $repository, $getUrlsForEvent, $relaysByUrl]) => {
    const hasNotification = (path: string, latestEvent: TrustedEvent | undefined) => {
      if (!latestEvent || latestEvent.pubkey === $pubkey) {
        return false
      }

      for (const [entryPath, ts] of Object.entries($checked)) {
        const isMatch =
          entryPath === "*" ||
          entryPath.startsWith(path) ||
          (entryPath === "/chat/*" && path.startsWith("/chat/"))

        if (isMatch && ts > latestEvent.created_at) {
          return false
        }
      }

      return true
    }

    // can update to tuple of (path, event_type) if later filtering is desired
    const paths = new Set<string>()

    for (const {pubkeys, messages} of $chats) {
      const chatPath = makeChatPath(pubkeys)

      if (hasNotification(chatPath, messages[0])) {
        paths.add("/chat")
        paths.add(chatPath)
      }
    }

    const allThreadEvents = $repository.query([
      {kinds: [THREAD]},
      {kinds: [COMMENT], "#K": [String(THREAD)]},
    ])

    const allCalendarEvents = $repository.query([
      {kinds: [EVENT_TIME]},
      {kinds: [COMMENT], "#K": [String(EVENT_TIME)]},
    ])

    const allMessageEvents = $repository.query([{kinds: [MESSAGE]}])

    for (const [url, rooms] of $userRoomsByUrl.entries()) {
      const spacePath = makeSpacePath(url)
      const threadPath = makeThreadPath(url)
      const calendarPath = makeCalendarPath(url)
      const messagesPath = makeSpaceChatPath(url)
      const threadEvents = allThreadEvents.filter(e => $getUrlsForEvent(e.id).includes(url))
      const calendarEvents = allCalendarEvents.filter(e => $getUrlsForEvent(e.id).includes(url))
      const messagesEvents = allMessageEvents.filter(e => $getUrlsForEvent(e.id).includes(url))

      if (hasNotification(threadPath, threadEvents[0])) {
        paths.add(spacePath)
        paths.add(threadPath)
      }

      if (hasNotification(calendarPath, calendarEvents[0])) {
        paths.add(spacePath)
        paths.add(calendarPath)
      }

      const commentsByThreadId = groupBy(
        e => getTagValue("E", e.tags),
        threadEvents.filter(spec({kind: COMMENT})),
      )

      for (const [threadId, [comment]] of commentsByThreadId.entries()) {
        const threadItemPath = makeThreadPath(url, threadId)

        if (hasNotification(threadItemPath, comment)) {
          paths.add(threadItemPath)
        }
      }

      const commentsByEventId = groupBy(
        e => getTagValue("E", e.tags),
        calendarEvents.filter(spec({kind: COMMENT})),
      )

      for (const [eventId, [comment]] of commentsByEventId.entries()) {
        const calendarEventPath = makeCalendarPath(url, eventId)

        if (hasNotification(calendarEventPath, comment)) {
          paths.add(calendarEventPath)
        }
      }

      if (hasNip29($relaysByUrl.get(url))) {
        for (const room of rooms) {
          const roomPath = makeRoomPath(url, room)
          const latestEvent = allMessageEvents.find(
            e =>
              $getUrlsForEvent(e.id).includes(url) &&
              e.tags.find(t => t[0] === "h" && t[1] === room),
          )

          if (hasNotification(roomPath, latestEvent)) {
            paths.add(spacePath)
            paths.add(roomPath)
          }
        }
      } else {
        if (hasNotification(messagesPath, messagesEvents[0])) {
          paths.add(spacePath)
          paths.add(messagesPath)
        }
      }
    }

    paths.add("pls")

    return paths
  },
)

export const badgeCount = derived(notifications, notifications => {
  // do filtering as desired?
  return notifications.size
})

export const handleBadgeCountChanges = async (count: number) => {
  if (get(userSettingsValues).show_notifications_badge) {
    await Badge.set({count})
  } else {
    await clearBadges()
  }
}

export const clearBadges = async () => {
  await Badge.clear()
}
