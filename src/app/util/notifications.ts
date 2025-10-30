import {derived, get} from "svelte/store"
import {synced, throttled} from "@welshman/store"
import {pubkey, relaysByUrl} from "@welshman/app"
import {prop, spec, identity, now, groupBy} from "@welshman/lib"
import type {TrustedEvent} from "@welshman/util"
import {ZAP_GOAL, EVENT_TIME, MESSAGE, THREAD, COMMENT, getTagValue} from "@welshman/util"
import {
  makeSpacePath,
  makeChatPath,
  makeGoalPath,
  makeThreadPath,
  makeCalendarPath,
  makeSpaceChatPath,
  makeRoomPath,
} from "@app/util/routes"
import {
  chats,
  hasNip29,
  getUrlsForEvent,
  repositoryStore,
  userSettingsValues,
  userGroupSelections,
  getSpaceUrlsFromGroupSelections,
  getSpaceRoomsFromGroupSelections,
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
      [pubkey, checked, chats, userGroupSelections, repositoryStore, getUrlsForEvent, relaysByUrl],
      identity,
    ),
  ),
  ([
    $pubkey,
    $checked,
    $chats,
    $userGroupSelections,
    $repository,
    $getUrlsForEvent,
    $relaysByUrl,
  ]) => {
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

    const paths = new Set<string>()

    for (const {pubkeys, messages} of $chats) {
      const chatPath = makeChatPath(pubkeys)

      if (hasNotification(chatPath, messages[0])) {
        paths.add("/chat")
        paths.add(chatPath)
      }
    }

    const allGoalComments = $repository.query([{kinds: [COMMENT], "#K": [String(ZAP_GOAL)]}])

    const allThreadComments = $repository.query([{kinds: [COMMENT], "#K": [String(THREAD)]}])

    const allCalendarComments = $repository.query([{kinds: [COMMENT], "#K": [String(EVENT_TIME)]}])

    const allMessages = $repository.query([{kinds: [MESSAGE, THREAD, ZAP_GOAL, EVENT_TIME]}])

    for (const url of getSpaceUrlsFromGroupSelections($userGroupSelections)) {
      const spacePath = makeSpacePath(url)
      const spacePathMobile = spacePath + ":mobile"
      const goalPath = makeGoalPath(url)
      const threadPath = makeThreadPath(url)
      const calendarPath = makeCalendarPath(url)
      const messagesPath = makeSpaceChatPath(url)
      const goalComments = allGoalComments.filter(e => $getUrlsForEvent(e.id).includes(url))
      const threadComments = allThreadComments.filter(e => $getUrlsForEvent(e.id).includes(url))
      const calendarComments = allCalendarComments.filter(e => $getUrlsForEvent(e.id).includes(url))
      const messages = allMessages.filter(e => $getUrlsForEvent(e.id).includes(url))

      const commentsByGoalId = groupBy(
        e => getTagValue("E", e.tags),
        goalComments.filter(spec({kind: COMMENT})),
      )

      for (const [goalId, [comment]] of commentsByGoalId.entries()) {
        const goalItemPath = makeGoalPath(url, goalId)

        if (hasNotification(spacePathMobile, comment)) {
          paths.add(spacePathMobile)
        }

        if (hasNotification(goalPath, comment)) {
          paths.add(goalPath)
        }

        if (hasNotification(goalItemPath, comment)) {
          paths.add(goalItemPath)
        }
      }

      const commentsByThreadId = groupBy(
        e => getTagValue("E", e.tags),
        threadComments.filter(spec({kind: COMMENT})),
      )

      for (const [threadId, [comment]] of commentsByThreadId.entries()) {
        const threadItemPath = makeThreadPath(url, threadId)

        if (hasNotification(spacePathMobile, comment)) {
          paths.add(spacePathMobile)
        }

        if (hasNotification(threadPath, comment)) {
          paths.add(threadPath)
        }

        if (hasNotification(threadItemPath, comment)) {
          paths.add(threadItemPath)
        }
      }

      const commentsByEventId = groupBy(
        e => getTagValue("E", e.tags),
        calendarComments.filter(spec({kind: COMMENT})),
      )

      for (const [eventId, [comment]] of commentsByEventId.entries()) {
        const calendarItemPath = makeCalendarPath(url, eventId)

        if (hasNotification(spacePathMobile, comment)) {
          paths.add(spacePathMobile)
        }

        if (hasNotification(calendarPath, comment)) {
          paths.add(calendarPath)
        }

        if (hasNotification(calendarItemPath, comment)) {
          paths.add(calendarItemPath)
        }
      }

      if (hasNip29($relaysByUrl.get(url))) {
        for (const h of getSpaceRoomsFromGroupSelections(url, $userGroupSelections)) {
          const roomPath = makeRoomPath(url, h)
          const latestEvent = allMessages.find(
            e => $getUrlsForEvent(e.id).includes(url) && e.tags.find(spec(["h", h])),
          )

          if (hasNotification(roomPath, latestEvent)) {
            paths.add(spacePathMobile)
            paths.add(spacePath)
            paths.add(roomPath)
          }
        }
      } else {
        if (hasNotification(messagesPath, messages[0])) {
          paths.add(spacePathMobile)
          paths.add(spacePath)
          paths.add(messagesPath)
        }
      }
    }

    return paths
  },
)

export const badgeCount = derived(notifications, notifications => {
  return notifications.size
})

export const handleBadgeCountChanges = async (count: number) => {
  if (get(userSettingsValues).show_notifications_badge) {
    try {
      await Badge.set({count})
    } catch (err) {
      // failed to set badge
    }
  } else {
    await clearBadges()
  }
}

export const clearBadges = async () => {
  await Badge.clear()
}
