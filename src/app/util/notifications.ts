import type {Unsubscriber, Readable, Subscriber} from "svelte/store"
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
  loadRelay,
  waitForThunkError,
  userMessagingRelayList,
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
  nth,
  nthEq,
  maybe,
  throttle,
} from "@welshman/lib"
import type {TrustedEvent, Filter} from "@welshman/util"
import {deriveEventsByIdByUrl} from "@welshman/store"
import {
  ZAP_GOAL,
  EVENT_TIME,
  THREAD,
  COMMENT,
  DELETE,
  getTagValue,
  getPubkeyTagValues,
  getRelaysFromList,
  matchFilters,
  sortEventsDesc,
  makeEvent,
  Address,
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
  notificationState,
  chatsById,
  hasNip29,
  getSettings,
  userSettingsValues,
  userGroupList,
  getSpaceUrlsFromGroupList,
  getSpaceRoomsFromGroupList,
  makeCommentFilter,
  userSpaceUrls,
  splitRoomId,
  makeRoomId,
  device,
} from "@app/core/state"
import {kv} from "@app/core/storage"
import {goto} from "$app/navigation"

// Temporarily copied from welshman

type Stores = Readable<any> | [Readable<any>, ...Array<Readable<any>>] | Array<Readable<any>>

const merged = <S extends Stores>(stores: S) => derived(stores, identity)

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
  derived([notifications, notificationSettings], identity).subscribe(
    async ([$notifications, $notificationSettings]) => {
      if ($notificationSettings.badge) {
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
  disable: () => Promise<void>
  enable: () => Promise<void>
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
  _controller = maybe<AbortController>()

  async request(prompt = true) {
    let status = await PushNotifications.checkPermissions()

    if (prompt && status.receive === "prompt") {
      status = await PushNotifications.requestPermissions()
    }

    if (status.receive !== "granted") {
      return status.receive
    }

    let {token} = notificationState.get()

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

      notificationState.update(assoc("token", token))
    }

    return token ? "granted" : "denied"
  }

  async _syncServer(signal: AbortSignal) {
    const {token, subscription} = notificationState.get()

    if (!token) {
      throw new Error("Attempted to sync push server without a token")
    }

    if (!subscription) {
      try {
        const channel = Capacitor.getPlatform() === "ios" ? "apns" : "fcm"
        const url = buildUrl(PUSH_SERVER, "subscription", channel)
        const res = await fetch(url, {
          signal,
          method: "POST",
          body: JSON.stringify({token}),
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
        })

        if (!res.ok) {
          console.warn(`Failed to register with push server (status ${res.status})`)
        } else {
          const json = await res.json()

          if (json?.callback && json?.key) {
            notificationState.update(assoc("subscription", json))
          } else {
            console.warn("Failed to register with push server (bad response)")
          }
        }
      } catch (e) {
        console.warn("Failed to register with push server:", e)
      }
    }
  }

  _getSubscriptionIdentifier = (relay: string, key: string) =>
    String(hash(relay + key + device.get()))

  _getPushStuff = async (url: string) => {
    let relay = await loadRelay(url)

    if (!relay?.self || !relay?.supported_nips?.map(String)?.includes("9a")) {
      relay = await loadRelay(PUSH_BRIDGE)
    }

    if (relay?.self) {
      return {url: relay.url, pubkey: relay.self}
    }
  }

  _syncRelay = async (relay: string, key: string, filters: Filter[], ignore: Filter[] = []) => {
    const {subscription} = notificationState.get()

    if (!subscription) {
      console.warn(`Failed to subscribe ${relay} to notifications: no subscription`)
      return
    }

    const stuff = await this._getPushStuff(relay)

    if (!stuff) {
      console.warn(`Failed to subscribe ${relay} to notifications: unsupported`)
      return
    }

    const {url, pubkey} = stuff
    const identifier = this._getSubscriptionIdentifier(relay, key)

    const thunk = publishThunk({
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

  _unsyncRelay = async (relay: string, keys: string[]) => {
    const stuff = await this._getPushStuff(relay)

    if (!stuff) {
      console.warn(`Failed to unsubscribe ${relay} from notifications: unsupported`)
      return
    }

    const {url} = stuff
    const tags: string[][] = []
    for (const key of keys) {
      const identifier = this._getSubscriptionIdentifier(relay, key)
      const address = new Address(30390, pubkey.get()!, identifier).toString()

      tags.push(["a", address])
    }

    const thunk = publishThunk({relays: [url], event: makeEvent(DELETE, {tags})})

    const error = await waitForThunkError(thunk)

    if (error) {
      console.warn(`Failed to unsubscribe ${relay} from notifications:`, error)
    }
  }

  async _syncSpaceSubscription(signal: AbortSignal) {
    signal.addEventListener(
      "abort",
      merged([userSpaceUrls, notificationSettings, userSettingsValues]).subscribe(
        throttle(3000, ([$userSpaceUrls, {spaces, mentions}, {muted_rooms}]) => {
          const filters = [{kinds: MESSAGE_KINDS}, makeCommentFilter(CONTENT_KINDS)]

          for (const url of $userSpaceUrls) {
            if (!spaces && !mentions) {
              this._unsyncRelay(url, ["spaces", "mentions"])
            } else if (!spaces) {
              this._unsyncRelay(url, ["spaces"])
            } else if (!mentions) {
              this._unsyncRelay(url, ["mentions"])
            }

            const mutedRooms = muted_rooms.map(splitRoomId).filter(nthEq(0, url)).map(nth(1))

            if (spaces) {
              this._syncRelay(url, "spaces", filters, [{"#h": [mutedRooms]}])
            }

            if (mentions) {
              const mentionFilters = filters.map(assoc("#p", [pubkey.get()!]))

              if (!spaces) {
                this._syncRelay(url, "mentions", mentionFilters)
              } else if (mutedRooms.length > 0) {
                this._syncRelay(url, "mentions", mentionFilters.map(assoc("#h", [mutedRooms])))
              }
            }
          }
        }),
      ),
    )
  }

  async _syncMessageSubscription(signal: AbortSignal) {
    signal.addEventListener(
      "abort",
      merged([userMessagingRelayList, notificationSettings]).subscribe(
        throttle(3000, ([$userMessagingRelayList, {messages}]) => {
          for (const url of getRelaysFromList($userMessagingRelayList)) {
            if (messages) {
              this._syncRelay(url, "messages", [{kinds: DM_KINDS, "#p": [pubkey.get()!]}])
            } else {
              this._unsyncRelay(url, ["messages"])
            }
          }
        }),
      ),
    )
  }

  async enable() {
    if (!this._controller) {
      this._controller = new AbortController()

      try {
        await this._syncServer(this._controller.signal)
        await this._syncSpaceSubscription(this._controller.signal)
        await this._syncMessageSubscription(this._controller.signal)
      } catch (e) {
        console.error(e)
      }
    }
  }

  async disable() {
    this._controller?.abort()
    this._controller = undefined

    const {subscription} = notificationState.get()

    if (subscription) {
      const res = await fetch(buildUrl(PUSH_SERVER, "subscription", subscription.key), {
        method: "delete",
      })

      if (!res.ok) {
        console.warn("Failed to delete push subscription")
      }
    }

    for (const url of get(userSpaceUrls)) {
      this._unsyncRelay(url, ["spaces", "mentions"])
    }

    for (const url of getRelaysFromList(get(userMessagingRelayList))) {
      this._unsyncRelay(url, ["messages"])
    }

    notificationState.set({})
  }
}

class WebNotifications implements IPushAdapter {
  _unsubscriber = maybe<Unsubscriber>()

  async request(prompt = true) {
    if (prompt && Notification?.permission === "default") {
      await Notification.requestPermission()
    }

    return Notification?.permission || "denied"
  }

  _notify(event: TrustedEvent, title: string, body: string) {
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

  async enable() {
    if (!this._unsubscriber) {
      this._unsubscriber = onNotification(event => {
        const {push, messages, mentions, spaces} = notificationSettings.get()

        if (push && document.hidden && Notification?.permission === "granted") {
          if (messages && matchFilters(dmFilters, event)) {
            this._notify(event, "New direct message", "Someone sent you a direct message.")
          } else if (
            mentions &&
            event.pubkey !== pubkey.get() &&
            getPubkeyTagValues(event.tags).includes(pubkey.get()!)
          ) {
            this._notify(event, "Someone mentioned you", "Someone tagged you in a message.")
          } else if (spaces) {
            this._notify(event, "New activity", "Someone posted a new message.")
          }
        }
      })
    }
  }

  async disable() {
    this._unsubscriber?.()
    this._unsubscriber = undefined
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

  static request() {
    return Push._getAdapter().request()
  }

  static disable() {
    return Push._getAdapter().disable()
  }

  static enable() {
    return Push._getAdapter().enable()
  }

  static sync() {
    return notificationSettings.subscribe(({push}) => {
      if (push) {
        Push.enable()
      } else {
        Push.disable()
      }
    })
  }
}
