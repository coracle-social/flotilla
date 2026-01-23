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
import type {Maybe} from "@welshman/lib"
import {
  on,
  call,
  assoc,
  poll,
  prop,
  sha256,
  textEncoder,
  parseJson,
  flatten,
  find,
  spec,
  first,
  identity,
  now,
  groupBy,
  tryCatch,
  postJson,
  fetchJson,
} from "@welshman/lib"
import type {TrustedEvent, Filter} from "@welshman/util"
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
  pushToken,
  pushSecret,
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

// Local notifications

interface IPushAdapter {
  request: () => Promise<string>
  start: () => Unsubscriber
}

class CapacitorNotifications implements IPushAdapter {
  async sync() {
    const token = get(pushToken)

    if (!token) {
      return
    }

    const info: Maybe<{
      secret: string
      callback: string
    }> = await tryCatch(async () => {
      const secret = get(pushSecret)

      if (secret) {
        const {callback} = await fetchJson(`${PUSH_SERVER}/subscription/${secret}`)

        if (callback) {
          return {secret, callback}
        } else {
          pushSecret.set(undefined)
        }
      }

      const ios = Capacitor.getPlatform() === "ios"
      const channel = ios ? "apns" : "fcm"
      const topic = "social.flotilla"
      const data = ios ? {token, topic} : {token}

      const json = await postJson(`${PUSH_SERVER}/subscription/${channel}`, data)

      if (json) {
        pushSecret.set(json.sk)

        return {secret: json.sk, callback: json.callback}
      }
    })

    if (!info) {
      return
    }

    const getPushStuff = async (url: string) => {
      let relay = await loadRelay(url)

      if (!relay?.self || !relay?.supported_nips?.includes("9a")) {
        relay = await loadRelay(PUSH_BRIDGE)
      }

      if (relay?.self) {
        return {url: relay.url, pubkey: relay.self}
      }
    }

    const syncSubscription = async (
      key: string,
      relay: string,
      filters: Filter[],
      ignore: Filter[] = [],
    ) => {
      const stuff = await getPushStuff(relay)

      if (!stuff) {
        console.warn(`Failed to subscribe ${relay} to ${key} notifications: unsupported`)
      } else {
        const {url, pubkey} = stuff
        const identifier = await sha256(textEncoder.encode(info.callback + relay + key))

        const thunk = publishThunk({
          relays: [url],
          event: makeEvent(30390, {
            content: await signer
              .get()
              .nip44.encrypt(
                pubkey,
                JSON.stringify([
                  ["relay", relay],
                  ["callback", info.callback],
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

      syncSubscription("spaces", relay, filters, ignore)
    }

    const $pubkey = pubkey.get()!

    for (const relay of getPubkeyRelays($pubkey, RelayMode.Messaging)) {
      const filters = [{kinds: DM_KINDS, "#p": [$pubkey]}]

      syncSubscription("messages", relay, filters)
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
      pushToken.set(token)

      return "granted"
    }

    pushToken.set(undefined)

    return "denied"
  }

  start() {
    this.sync().then(() => {
      PushNotifications.addListener(
        "pushNotificationActionPerformed",
        async (action: ActionPerformed) => {
          const event = parseJson(action.notification.data.event)
          const relays = [action.notification.data.relay]

          goto(await getEventPath(event, relays))
        },
      )
    })

    return () => PushNotifications.removeAllListeners()
  }
}

class WebNotifications implements IPushAdapter {
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
    return onNotification(event => {
      const {alerts_messages, alerts_mentions, alerts_spaces} = getSettings()

      if (document.hidden && Notification?.permission === "granted") {
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
}

export class Push {
  static _adapter: IPushAdapter | undefined
  static _unsubscriber: Unsubscriber | undefined

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
    return Push._getAdapter().start()
  }

  static request() {
    return Push._getAdapter().request()
  }

  static resume() {
    const unsubscribe = userSettingsValues.subscribe(({alerts_push}) => {
      if (alerts_push) {
        const promise = Push.request()
        const controller = new AbortController()

        promise.then(permissions => {
          if (permissions === "granted" && !controller.signal.aborted) {
            controller.signal.addEventListener("abort", Push.start())
          }
        })

        Push._unsubscriber = () => controller.abort()
      } else {
        Push.stop()
      }
    })

    return () => {
      unsubscribe()
      Push.stop()
    }
  }

  static stop() {
    Push._unsubscriber?.()
    Push._unsubscriber = undefined
  }
}
