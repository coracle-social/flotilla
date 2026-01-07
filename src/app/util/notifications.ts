import {derived, get} from "svelte/store"
import {Badge} from "@capawesome/capacitor-badge"
import {synced, throttled} from "@welshman/store"
import {pubkey, tracker, repository, relaysByUrl} from "@welshman/app"
import {prop, find, call, spec, first, identity, now, groupBy} from "@welshman/lib"
import type {TrustedEvent} from "@welshman/util"
import {deriveEventsByIdByUrl} from "@welshman/store"
import {
  ZAP_GOAL,
  EVENT_TIME,
  MESSAGE,
  THREAD,
  COMMENT,
  getTagValue,
  sortEventsDesc,
} from "@welshman/util"
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
  chatsById,
  hasNip29,
  userSettingsValues,
  userGroupList,
  getSpaceUrlsFromGroupList,
  getSpaceRoomsFromGroupList,
} from "@app/core/state"
import {kv} from "@app/core/storage"

// Checked state

export const checked = synced<Record<string, number>>({
  key: "checked",
  defaultValue: {},
  storage: kv,
})

export const deriveChecked = (key: string) => derived(checked, prop(key))

export const setChecked = (key: string) => checked.update(state => ({...state, [key]: now()}))

// Derived notifications state

export const notifications = call(() => {
  const goalCommentFilters = [{kinds: [COMMENT], "#K": [String(ZAP_GOAL)]}]
  const threadCommentFilters = [{kinds: [COMMENT], "#K": [String(THREAD)]}]
  const calendarCommentFilters = [{kinds: [COMMENT], "#K": [String(EVENT_TIME)]}]
  const messageFilters = [{kinds: [MESSAGE, THREAD, ZAP_GOAL, EVENT_TIME]}]

  return derived(
    throttled(
      1000,
      derived(
        [
          pubkey,
          checked,
          chatsById,
          userGroupList,
          relaysByUrl,
          deriveEventsByIdByUrl({tracker, repository, filters: goalCommentFilters}),
          deriveEventsByIdByUrl({tracker, repository, filters: threadCommentFilters}),
          deriveEventsByIdByUrl({tracker, repository, filters: calendarCommentFilters}),
          deriveEventsByIdByUrl({tracker, repository, filters: messageFilters}),
        ],
        identity,
      ),
    ),
    ([
      $pubkey,
      $checked,
      $chatsById,
      $userGroupList,
      $relaysByUrl,
      goalCommentsByUrl,
      threadCommentsByUrl,
      calendarCommentsByUrl,
      messagesByUrl,
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

      for (const {pubkeys, messages} of $chatsById.values()) {
        const chatPath = makeChatPath(pubkeys)

        if (hasNotification(chatPath, messages[0])) {
          paths.add("/chat")
          paths.add(chatPath)
        }
      }

      for (const url of getSpaceUrlsFromGroupList($userGroupList)) {
        const spacePath = makeSpacePath(url)
        const spacePathMobile = spacePath + ":mobile"
        const goalPath = makeGoalPath(url)
        const threadPath = makeThreadPath(url)
        const calendarPath = makeCalendarPath(url)
        const messagesPath = makeSpaceChatPath(url)
        const goalComments = sortEventsDesc(goalCommentsByUrl.get(url)?.values() || [])
        const threadComments = sortEventsDesc(threadCommentsByUrl.get(url)?.values() || [])
        const calendarComments = sortEventsDesc(calendarCommentsByUrl.get(url)?.values() || [])
        const messages = sortEventsDesc(messagesByUrl.get(url)?.values() || [])

        const commentsByGoalId = groupBy(
          e => getTagValue("E", e.tags),
          goalComments.filter(spec({kind: COMMENT})),
        )

        for (const [goalId, [comment]] of commentsByGoalId.entries()) {
          const goalItemPath = makeGoalPath(url, goalId)

          if (hasNotification(goalPath, comment)) {
            paths.add(spacePathMobile)
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

          if (hasNotification(threadPath, comment)) {
            paths.add(spacePathMobile)
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

          if (hasNotification(calendarPath, comment)) {
            paths.add(spacePathMobile)
            paths.add(calendarPath)
          }

          if (hasNotification(calendarItemPath, comment)) {
            paths.add(calendarItemPath)
          }
        }

        if (hasNip29($relaysByUrl.get(url))) {
          for (const h of getSpaceRoomsFromGroupList(url, $userGroupList)) {
            const roomPath = makeRoomPath(url, h)
            const latestEvent = find(e => e.tags.some(spec(["h", h])), messages)

            if (hasNotification(roomPath, latestEvent)) {
              paths.add(spacePathMobile)
              paths.add(spacePath)
              paths.add(roomPath)
            }
          }
        } else {
          if (hasNotification(messagesPath, first(messages))) {
            paths.add(spacePathMobile)
            paths.add(spacePath)
            paths.add(messagesPath)
          }
        }
      }

      return paths
    },
  )
})

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
