import type {Unsubscriber, Subscriber} from "svelte/store"
import {derived, get} from "svelte/store"
import {Capacitor} from "@capacitor/core"
import {Badge} from "@capawesome/capacitor-badge"
import {PushNotifications} from "@capacitor/push-notifications"
import type {ActionPerformed, RegistrationError, Token} from "@capacitor/push-notifications"
import {synced, throttled} from "@welshman/store"
import {
  pubkey,
  tracker,
  repository,
  relaysByUrl,
  signer,
  publishThunk,
  getPubkeyRelays,
  loadRelay,
  waitForThunkError,
} from "@welshman/app"
import {
  on,
  call,
  assoc,
  poll,
  prop,
  hash,
  parseJson,
  flatten,
  find,
  spec,
  first,
  identity,
  now,
  groupBy,
  postJson,
} from "@welshman/lib"
import type {TrustedEvent, RelayProfile, Filter} from "@welshman/util"
import {deriveEventsByIdByUrl} from "@welshman/store"
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
import {buildUrl} from "@lib/util"
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
  notificationSettings,
  chatsById,
  hasNip29,
  getSettings,
  userSettingsValues,
  userGroupList,
  getSpaceUrlsFromGroupList,
  getSpaceRoomsFromGroupList,
  makeCommentFilter,
  userSpaceUrls,
  makeRoomId,
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
const messageFilters = [{kinds: MESSAGE_KINDS}]
const dmFilters = [{kinds: DM_KINDS}]
const allFilters = flatten([
  goalCommentFilters,
  threadCommentFilters,
  calendarCommentFilters,
  messageFilters,
  dmFilters,
])

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

export const onNotification = call(() => {
  const filters = allFilters.map(assoc("since", now()))
  const subscribers: Subscriber<TrustedEvent>[] = []

  let unsubscribe: Unsubscriber | undefined

  return (f: (event: TrustedEvent) => void) => {
    subscribers.push(f)

    if (!unsubscribe) {
      unsubscribe = on(repository, "update", ({added}) => {
        const $pubkey = pubkey.get()
        const {muted_rooms} = getSettings()

        for (const event of added) {
          if (event.pubkey == $pubkey) {
            continue
          }

          const h = getTagValue("h", event.tags)
          const muted = Array.from(tracker.getRelays(event.id)).every(
            url => h && muted_rooms.includes(makeRoomId(url, h)),
          )

          if (muted) {
            continue
          }

          if (matchFilters(filters, event)) {
            for (const f of subscribers) {
              f(event)
            }
          }
        }
      })
    }

    return () => {
      subscribers.splice(subscribers.indexOf(f), 1)

      if (subscribers.length === 0) {
        unsubscribe?.()
        unsubscribe = undefined
      }
    }
  }
})

// Badges

export const syncBadges = () =>
  derived([notifications, userSettingsValues], identity).subscribe(
    async ([$notifications, {alerts_badge}]) => {
      if (alerts_badge) {
        try {
          await Badge.set({count: $notifications.size})
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

// Push notifications

interface IPushAdapter {
  request: (prompt?: boolean) => Promise<string>
  enable: () => Promise<void>
  disable: () => Promise<void>
  start: () => Unsubscriber
}

if (Capacitor.isNativePlatform()) {
  PushNotifications.addListener(
    "pushNotificationActionPerformed",
    async (action: ActionPerformed) => {
      const event = parseJson(action.notification.data.event)
      const relays = [action.notification.data.relay]

      goto(await getEventPath(event, relays))
    },
  )
}

class CapacitorNotifications implements IPushAdapter {
  async request(prompt = true) {
    let status = await PushNotifications.checkPermissions()

    if (prompt && status.receive === "prompt") {
      status = await PushNotifications.requestPermissions()
    }

    if (status.receive !== "granted") {
      return status.receive
    }

    let {token} = notificationSettings.get()

    if (!token) {
      PushNotifications.addListener("registration", ({value}: Token) => {
        token = value
      })

      PushNotifications.addListener("registrationError", (error: RegistrationError) => {
        console.error(error)
      })

      await Promise.all([
        PushNotifications.register(),
        poll({
          condition: () => Boolean(token),
          signal: AbortSignal.timeout(5000),
        }),
      ])

      notificationSettings.update(assoc("token", token))
    }

    return token ? "granted" : "denied"
  }

  async syncServer(signal: AbortSignal) {
    const {token} = notificationSettings.get()

    if (!token) {
      throw new Error("Attempted to sync push server without a token")
    }

    const channel = Capacitor.getPlatform() === "ios" ? "apns" : "fcm"
    const url = buildUrl(PUSH_SERVER, "subscription", channel)
    const json = await postJson(url, {token}, {signal})

    if (json?.callback && json?.id) {
      notificationSettings.update(assoc("subscription", json))
    } else {
      console.warn("Failed to register with push server")
    }
  }

  async syncRelays(signal: AbortSignal) {
    const {subscription} = notificationSettings.get()

    if (!subscription) {
      throw new Error("Attempted to sync relays without a subscription")
    }

    const canPush = (relay?: RelayProfile) =>
      Boolean(relay?.self && relay?.supported_nips?.map(String)?.includes("9a"))

    const getPushStuff = async (url: string) => {
      let relay = await loadRelay(url)

      if (!canPush(relay)) {
        relay = await loadRelay(PUSH_BRIDGE)
      }

      if (relay?.self) {
        return {url: relay.url, pubkey: relay.self}
      }
    }

    const syncRelay = async (
      key: string,
      relay: string,
      filters: Filter[],
      ignore: Filter[] = [],
    ) => {
      if (signal.aborted) {
        return
      }

      const stuff = await getPushStuff(relay)

      if (!stuff) {
        console.warn(`Failed to subscribe ${relay} to ${key} notifications: unsupported`)
      } else {
        const {url, pubkey} = stuff
        const identifier = String(hash(subscription.callback + relay + key))

        const thunk = publishThunk({
          signal,
          relays: [url],
          event: makeEvent(30390, {
            content: await signer
              .get()
              .nip44.encrypt(
                pubkey,
                JSON.stringify([
                  ["relay", relay],
                  ["callback", subscription.callback],
                  ...ignore.map(filter => ["ignore", JSON.stringify(filter)]),
                  ...filters.map(filter => ["filter", JSON.stringify(filter)]),
                ]),
              ),
            tags: [
              ["d", identifier],
              ["p", pubkey],
            ],
          }),
        })

        const error = await waitForThunkError(thunk)

        if (error) {
          console.warn(`Failed to subscribe ${relay} to ${key} notifications:`, error)
        }
      }
    }

    for (const relay of get(userSpaceUrls)) {
      const {muted_rooms} = getSettings()
      const filters = [{kinds: MESSAGE_KINDS}, makeCommentFilter(CONTENT_KINDS)]
      const ignore = [{"#h": [muted_rooms]}]

      syncRelay("spaces", relay, filters, ignore)
    }

    const $pubkey = pubkey.get()!

    for (const relay of getPubkeyRelays($pubkey, RelayMode.Messaging)) {
      const filters = [{kinds: DM_KINDS, "#p": [$pubkey]}]

      syncRelay("messages", relay, filters)
    }
  }

  start() {
    const {token} = notificationSettings.get()
    const controller = new AbortController()
    const {signal} = controller

    if (!token) {
      console.warn("Attempted to start push notifications without a callback")
    } else {
      call(async () => {
        try {
          if (!notificationSettings.get().subscription) {
            await this.syncServer(signal)
          }

          if (notificationSettings.get().subscription) {
            await this.syncRelays(signal)
          }
        } catch (e) {
          console.error(e)
        }
      })
    }

    return () => controller.abort()
  }

  async enable() {
    notificationSettings.update(assoc("push", true))
  }

  async disable() {
    const {subscription, ...settings} = notificationSettings.get()

    await PushNotifications.unregister()

    if (subscription) {
      const res = await fetch(buildUrl(PUSH_SERVER, "subscription", subscription.key), {
        method: "delete",
      })

      if (!res.ok) {
        console.warn("Failed to delete push subscription")
      }
    }

    notificationSettings.set({...settings, push: false})
  }
}

class WebNotifications implements IPushAdapter {
  async request(prompt = true) {
    if (prompt && Notification?.permission === "default") {
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
    return onNotification(event => {
      const {alerts_push, alerts_messages, alerts_mentions, alerts_spaces} = getSettings()

      if (alerts_push && document.hidden && Notification?.permission === "granted") {
        if (alerts_messages && matchFilters(dmFilters, event)) {
          this.notify(event, "New direct message", "Someone sent you a direct message.")
        } else if (
          alerts_mentions &&
          event.pubkey !== pubkey.get() &&
          getPubkeyTagValues(event.tags).includes(pubkey.get()!)
        ) {
          this.notify(event, "Someone mentioned you", "Someone tagged you in a message.")
        } else if (alerts_spaces) {
          this.notify(event, "New activity", "Someone posted a new message.")
        }
      }
    })
  }

  async enable() {
    notificationSettings.update(assoc("push", true))
  }

  async disable() {
    notificationSettings.update(assoc("push", false))
  }
}

export class Push {
  static _adapter: IPushAdapter | undefined

  static _getAdapter() {
    if (!Push._adapter) {
      if (Capacitor.isNativePlatform()) {
        Push._adapter = new CapacitorNotifications()
      } else {
        Push._adapter = new WebNotifications()
      }
    }

    return Push._adapter
  }

  static start() {
    const adapter = Push._getAdapter()
    const promise = adapter.request(false)
    const controller = new AbortController()

    promise.then(permissions => {
      if (permissions === "granted" && !controller.signal.aborted) {
        controller.signal.addEventListener("abort", adapter.start())
      }
    })

    return () => controller.abort()
  }

  static request() {
    return Push._getAdapter().request()
  }

  static enable() {
    return Push._getAdapter().enable()
  }

  static disable() {
    return Push._getAdapter().disable()
  }
}
