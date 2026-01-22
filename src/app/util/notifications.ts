import type {Unsubscriber} from "svelte/store"
import {derived, get} from "svelte/store"
import {Capacitor} from "@capacitor/core"
import {Badge} from "@capawesome/capacitor-badge"
import {PushNotifications} from "@capacitor/push-notifications"
import type {ActionPerformed, RegistrationError, Token} from "@capacitor/push-notifications"
import {synced, throttled} from "@welshman/store"
import {pubkey, tracker, repository, relaysByUrl, signer, publishThunk, getPubkeyRelays, loadRelay} from "@welshman/app"
import {
  poll,
  prop,
  sha256,
  textEncoder,
  parseJson,
  ms,
  maybe,
  int,
  MINUTE,
  flatten,
  find,
  spec,
  first,
  identity,
  now,
  groupBy,
  hash,
  tryCatch,
  postJson,
  fetchJson,
} from "@welshman/lib"
import type {TrustedEvent} from "@welshman/util"
import {
  deriveEventsByIdByUrl,
  deriveEventsById,
  deriveEventsDesc,
  deriveDeduplicated,
} from "@welshman/store"
import {
  ZAP_GOAL,
  EVENT_TIME,
  THREAD,
  COMMENT,
  getTagValue,
  getPubkeyTagValues,
  matchFilters,
  sortEventsDesc,
  makeEvent,
  RelayMode,
} from "@welshman/util"
import {
  makeSpacePath,
  makeChatPath,
  makeGoalPath,
  makeThreadPath,
  makeCalendarPath,
  makeSpaceChatPath,
  makeRoomPath,
  getEventPath,
  goToEvent,
} from "@app/util/routes"
import {
  DM_KINDS,
  CONTENT_KINDS,
  MESSAGE_KINDS,
  PUSH_BRIDGE,
  PUSH_SERVER,
  alertToken,
  alertSecret,
  chatsById,
  hasNip29,
  getSetting,
  userGroupList,
  getSpaceUrlsFromGroupList,
  getSpaceRoomsFromGroupList,
  makeCommentFilter,
  userSpaceUrls,
} from "@app/core/state"
import {kv} from "@app/core/storage"
import {goto} from "$app/navigation"

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
const messageFilters = [{kinds: CONTENT_KINDS}]
const dmFilters = [{kinds: DM_KINDS}]
const allFilters = flatten([
  goalCommentFilters,
  threadCommentFilters,
  calendarCommentFilters,
  messageFilters,
  dmFilters,
])

export const latestNotification = deriveDeduplicated(
  deriveEventsDesc(deriveEventsById({repository, filters: allFilters})),
  first,
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
  if (getSetting<boolean>("alerts_badge")) {
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
  async ensureSubscription() {
    const token = get(alertToken)

    if (!token) {
      return
    }

    const info = await tryCatch(async () => {
      const secret = get(alertSecret)

      if (secret) {
        const {callback} = await fetchJson(`${PUSH_SERVER}/subscription/${secret}`)

        if (callback) {
          return {secret, callback}
        }
      }

      const ios = Capacitor.getPlatform() === "ios"
      const channel = ios ? "apns" : "fcm"
      const topic = "social.flotilla"
      const data = ios ? {token, topic} : {token}

      const json = await postJson(`${PUSH_SERVER}/subscription/${channel}`, data)

      if (json) {
        return {
          secret: json.sk,
          callback: json.callback,
        } as {
          secret: string
          callback: string
        }
      }
    })

    if (info) {
      alertSecret.set(info.secret)

      const getPushStuff = async (url: string) => {
        let relay = await loadRelay(url)

        if (!relay?.self || !relay?.supported_nips?.includes("9a")) {
          relay = await loadRelay(PUSH_BRIDGE)
        }

        if (relay?.self) {
          return {url: relay.url, pubkey: relay.self}
        }
      }

      for (const url of get(userSpaceUrls)) {
        const stuff = await getPushStuff(url)

        if (!stuff) {
          console.warn(`Failed to subscribe ${url} to space notifications`)
          continue
        }

        const filters = [{kinds: MESSAGE_KINDS}, makeCommentFilter(CONTENT_KINDS)]
        // const ignore = [] todo - muted rooms

        publishThunk({
          relays: [stuff.url],
          event: makeEvent(30390, {
            content: await signer
              .get()
              .nip44.encrypt(stuff.pubkey, JSON.stringify([
                ["relay", url],
                ["callback", info.callback],
                // ...ignore.map(filter => ["ignore", JSON.stringify(filter)]),
                ...filters.map(filter => ["filter", JSON.stringify(filter)]),
              ])),
            tags: [
              ["d", await sha256(textEncoder.encode(info.callback + url + "spaces"))],
              ["p", stuff.pubkey],
            ],
          }),
        })
      }

      const $pubkey = pubkey.get()!

      for (const url of getPubkeyRelays($pubkey, RelayMode.Messaging)) {
        const stuff = await getPushStuff(url)

        if (!stuff) {
          console.warn(`Failed to subscribe ${url} to messaging notifications`)
          continue
        }

        publishThunk({
          relays: [stuff.url],
          event: makeEvent(30390, {
            content: await signer
              .get()
              .nip44.encrypt(stuff.pubkey, JSON.stringify([
                ["relay", url],
                ["callback", info.callback],
                ["filter", JSON.stringify({kinds: DM_KINDS, '#p': [$pubkey]})],
              ])),
            tags: [
              ["d", await sha256(textEncoder.encode(info.callback + url + "messages"))],
              ["p", stuff.pubkey],
            ],
          }),
        })
      }
    } else {
      alertSecret.set(undefined)
    }
  }

  async request() {
    let status = await PushNotifications.checkPermissions()

    if (status.receive === "prompt") {
      status = await PushNotifications.requestPermissions()
    }

    if (status.receive !== "granted") {
      return status.receive
    }

    let token = ""

    PushNotifications.addListener("registration", ({value}: Token) => {
      token = value
    })

    PushNotifications.addListener("registrationError", (error: RegistrationError) => {
      console.error(error)
    })

    await PushNotifications.register()
    await poll({
      condition: () => Boolean(token),
      signal: AbortSignal.timeout(5000),
    })

    if (token) {
      alertToken.set(token)

      return "granted"
    }

    alertToken.set(undefined)

    return "denied"
  }

  start() {
    this.ensureSubscription().then(() => {
      PushNotifications.addListener(
        "pushNotificationActionPerformed",
        async (action: ActionPerformed) => {
          const event = parseJson(action.notification.data.event)
          const relays = [action.notification.data.relay]

          goto(await getEventPath(event, relays))
        }
      )
    })

    return () => PushNotifications.removeAllListeners()
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
    const notification = new Notification(title, {
      body,
      tag: event.id,
      icon: "/icon.png",
      badge: "/icon.png",
    })

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
        if (getSetting<boolean>("alerts_messages") && matchFilters(dmFilters, event)) {
          this.notify(event, "New direct message", "Someone sent you a direct message.")
        } else if (
          event.pubkey !== pubkey.get() &&
          getSetting<boolean>("alerts_mentions") &&
          getPubkeyTagValues(event.tags).includes(pubkey.get()!)
        ) {
          this.notify(event, "Someone mentioned you", "Someone tagged you in a message.")
        } else if (getSetting<boolean>("alerts_spaces")) {
          this.notify(event, "New activity", "Someone posted a new message.")
        }
      }
    })
  }
}

export class Alerts {
  static _adapter: IAlertsAdapter | undefined
  static _unsubscriber: Unsubscriber | undefined

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
    if (getSetting<boolean>("alerts_push")) {
      const promise = Alerts.request()
      const controller = new AbortController()

      promise.then(permissions => {
        if (permissions === "granted" && !controller.signal.aborted) {
          controller.signal.addEventListener("abort", Alerts.start())
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
