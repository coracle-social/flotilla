import type {Unsubscriber} from 'svelte/store'
import {derived, get} from "svelte/store"
import {Capacitor} from "@capacitor/core"
import {Badge} from "@capawesome/capacitor-badge"
import {synced, throttled} from "@welshman/store"
import {pubkey, tracker, repository, relaysByUrl} from "@welshman/app"
import {prop, ms, maybe, int, MINUTE, flatten, find, spec, first, identity, now, groupBy, hash} from "@welshman/lib"
import type {TrustedEvent} from "@welshman/util"
import {deriveEventsByIdByUrl, deriveEventsById, deriveEventsDesc, deriveDeduplicated} from "@welshman/store"
import {
  DIRECT_MESSAGE,
  DIRECT_MESSAGE_FILE,
  ZAP_GOAL,
  EVENT_TIME,
  MESSAGE,
  THREAD,
  COMMENT,
  getTagValue,
  getPubkeyTagValues,
  matchFilters,
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
  goToEvent,
} from "@app/util/routes"
import {
  chatsById,
  hasNip29,
  getSetting,
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

const goalCommentFilters = [{kinds: [COMMENT], "#K": [String(ZAP_GOAL)]}]
const threadCommentFilters = [{kinds: [COMMENT], "#K": [String(THREAD)]}]
const calendarCommentFilters = [{kinds: [COMMENT], "#K": [String(EVENT_TIME)]}]
const messageFilters = [{kinds: [MESSAGE, THREAD, ZAP_GOAL, EVENT_TIME]}]
const dmFilters = [{kinds: [DIRECT_MESSAGE, DIRECT_MESSAGE_FILE]}]
const allFilters = flatten([goalCommentFilters, threadCommentFilters, calendarCommentFilters, messageFilters, dmFilters])

export const latestNotification = deriveDeduplicated(
  deriveEventsDesc(deriveEventsById({repository, filters: allFilters})),
  first
)

export const notifications = derived(
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

// Badges

export const badgeCount = derived(notifications, notifications => {
  return notifications.size
})

export const handleBadgeCountChanges = async (count: number) => {
  if (getSetting<boolean>('alerts_badge')) {
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

// Local notifications

interface IAlertsAdapter {
  request: () => Promise<string>
  start: () => Unsubscriber
}

class CapacitorNotifications implements IAlertsAdapter {
  async request() {
    return "denied"
  }

  start() {
    return () => undefined
  }
}

class WebNotifications implements IAlertsAdapter {
  async request() {
    if (Notification?.permission === "default") {
      await Notification.requestPermission()
    }

    return Notification?.permission || "denied"
  }

  notify(event: TrustedEvent, title: string, body: string) {
    const notification = new Notification(title, {body, tag: event.id, icon: "/icon.png", badge: "/icon.png"})

    notification.onclick = () => {
      window.focus()
      goToEvent(event)
      notification.close()
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        notification.close()
        document.removeEventListener("visibilitychange", onVisibilityChange)
      }
    }

    document.addEventListener("visibilitychange", onVisibilityChange)
  }

  start() {
    let initialized = false

    return latestNotification.subscribe(event => {
      if (!initialized) {
        initialized = true
      } else if (event && document.hidden && Notification?.permission === "granted") {
        if (getSetting<boolean>('alerts_messages') && matchFilters(dmFilters, event)) {
          this.notify(event, "New direct message", "Someone sent you a direct message.")
        } else if (getSetting<boolean>('alerts_mentions') && event.pubkey !== pubkey.get() && getPubkeyTagValues(event.tags).includes(pubkey.get())) {
          this.notify(event, "Someone mentioned you", "Someone tagged you in a message.")
        } else if (getSetting<boolean>('alerts_spaces')) {
          this.notify(event, "New activity", "Someone posted a new message.")
        }
      }
    })
  }
}

export class Alerts {
  static _adapter: IAlertsAdapter
  static _unsubscriber: Unsubscriber

  static _getAdapter() {
    if (!Alerts._adapter) {
      if (Capacitor.isNativePlatform()) {
        Alerts._adapter = new CapacitorNotifications()
      } else {
        Alerts._adapter = new WebNotifications()
      }
    }

    return Alerts._adapter
  }

  static start() {
    return Alerts._getAdapter().start()
  }

  static request() {
    return Alerts._getAdapter().request()
  }

  static resume() {
    if (getSetting<boolean>('alerts_push')) {
      const promise = Alerts.request()
      const controller = new AbortController()

      promise.then(permissions => {
        if (permissions === "granted" && !controller.signal.aborted) {
          controller.signal.addEventListener('abort', Alerts.start())
        }
      })

      Alerts._unsubscriber = () => controller.abort()
    }

    return Alerts.stop
  }

  static stop() {
    Alerts._unsubscriber?.()
    Alerts._unsubscriber = undefined
  }
}
