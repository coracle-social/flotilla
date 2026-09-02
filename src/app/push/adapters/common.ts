import {writable} from "svelte/store"
import type {Subscriber, Unsubscriber} from "svelte/store"
import {
  PushNotifications,
  type ActionPerformed,
  type RegistrationError,
  type Token,
} from "@capacitor/push-notifications"
import type {PluginListenerHandle} from "@capacitor/core"
import {goto} from "$app/navigation"
import {assoc, call, now, on, poll, spec, throttle, uniq} from "@welshman/lib"
import {LOCAL_RELAY_URL} from "@welshman/net"
import type {RepositoryUpdate} from "@welshman/net"
import {
  getIdFilters,
  matchFilters,
  tagSpec,
  tagValue,
  MESSAGE,
  WRAP,
  type Filter,
  type TrustedEvent,
} from "@welshman/util"
import {merged, withGetter} from "@welshman/store"
import {User} from "@welshman/app"
import {app, messagingRelayLists, network, roomLists} from "@app/core"
import {DM_KINDS, CONTENT_KINDS, makeCommentFilter} from "@app/content"
import {getMutedRooms, notificationSettings, shouldNotify, userSettingsValues} from "@app/settings"
import {makeEventPath, goToChat, goToSpace} from "@app/routes"

export type PushSubscription = {
  key: string
  callback: string
}

export type PushState = {
  token?: string
  useFallback?: boolean
  subscription?: PushSubscription
}

export const pushState = withGetter(writable<PushState>({}))

export interface IPushAdapter {
  request: (prompt?: boolean) => Promise<string>
  disable: () => Promise<void>
  enable: () => Promise<void>
}

export type PushPermissionResult = {
  token?: string
  error?: string
}

export const onNotification = call(() => {
  const allFilters = [
    {kinds: [MESSAGE, ...CONTENT_KINDS, ...DM_KINDS]},
    makeCommentFilter(CONTENT_KINDS),
  ]
  const filters = allFilters.map(assoc("since", now()))
  const subscribers: Subscriber<TrustedEvent>[] = []

  let unsubscribe: Unsubscriber | undefined

  return (f: (event: TrustedEvent) => void) => {
    subscribers.push(f)

    if (!unsubscribe) {
      unsubscribe = on(app.get().repository, "update", ({added}: RepositoryUpdate) => {
        const $pubkey = app.get().user?.pubkey

        for (const event of added) {
          if (event.pubkey == $pubkey) {
            continue
          }

          const h = tagValue(tagSpec("h"), event.tags)

          if (
            Array.from(app.get().tracker.getRelays(event.id)).every(url => !shouldNotify(url, h))
          ) {
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

const loadNotificationEvent = (relay: string, id: string) =>
  network.get().request({
    filters: getIdFilters([id]),
    relays: [relay, LOCAL_RELAY_URL],
    // The local relay eoses immediately, so anything less waits on it alone
    threshold: 1,
    autoClose: true,
    signal: AbortSignal.timeout(5000),
  })

// Wraps are ingested into the repository and unwrapped in the background, so wait for the rumor
const loadNotificationRumor = async (wrap: TrustedEvent) => {
  const getRumor = () => app.get().wrapManager.getRumor(wrap.id)

  await poll({condition: () => Boolean(getRumor()), signal: AbortSignal.timeout(5000)})

  return getRumor()
}

export const onPushNotificationAction = async (action: ActionPerformed) => {
  const {relay, id} = action.notification.data
  const [event] = await loadNotificationEvent(relay, id)
  const target = event?.kind === WRAP ? await loadNotificationRumor(event) : event
  const path = target && makeEventPath(target, [relay])

  // Kinds we have no route for get a coracle.social permalink, which goto refuses
  if (path && !path.includes("://")) {
    goto(path)
  } else if (event?.kind === WRAP) {
    goToChat()
  } else {
    goToSpace(relay)
  }
}

export const requestPermissions = async (): Promise<string> => {
  let status = await PushNotifications.checkPermissions()

  if (["prompt", "prompt-with-rationale"].includes(status.receive)) {
    status = await PushNotifications.requestPermissions()
  }

  return status.receive
}

export const requestToken = async (): Promise<PushPermissionResult> => {
  let {token} = pushState.get()
  let error = "failed to retrieve token"

  if (!token) {
    const listeners = [
      PushNotifications.addListener("registration", ({value}: Token) => {
        token = value
      }),
      PushNotifications.addListener("registrationError", (err: RegistrationError) => {
        error = err.error
      }),
    ]

    await Promise.all([
      PushNotifications.register(),
      poll({
        condition: () => Boolean(token),
        signal: AbortSignal.timeout(5000),
      }),
    ])

    listeners.forEach(p => p.then((listener: PluginListenerHandle) => listener.remove()))
  }

  return token ? {token} : {error}
}

export const syncRelaySubscriptions = (
  signal: AbortSignal,
  sync: (url: string, key: string, filters: Filter[], ignore: Filter[]) => void,
) => {
  const $pubkey = User.require(app.get()).pubkey

  const unsubscribeSpaces = merged([
    roomLists.get().urls($pubkey).$,
    notificationSettings,
    userSettingsValues,
  ]).subscribe(
    throttle(3000, ([$spaceUrls, {spaces, mentions}, $settings]) => {
      const baseFilters = [{kinds: [MESSAGE, ...CONTENT_KINDS]}, makeCommentFilter(CONTENT_KINDS)]

      for (const url of $spaceUrls) {
        const {notify = true, exceptions = []} = $settings.alerts.find(spec({url})) || {}
        const muted = getMutedRooms($settings, url)
        const filters: Filter[] = []
        const ignore: Filter[] = []

        if (spaces) {
          if (notify) {
            const skipped = uniq([...exceptions, ...muted])

            if (skipped.length > 0) {
              ignore.push({"#h": skipped})
            }
            filters.push(...baseFilters)
          } else {
            const included = exceptions.filter(h => !muted.includes(h))

            if (included.length > 0) {
              filters.push(...baseFilters.map(f => ({...f, "#h": included})))
            }
          }
        }

        if (mentions) {
          filters.push(...baseFilters.map(f => ({...f, "#p": [$pubkey]})))
        }

        sync(url, "spaces", filters, ignore)
      }
    }),
  )

  const unsubscribeMessages = merged([
    messagingRelayLists.get().urls($pubkey).$,
    notificationSettings,
  ]).subscribe(
    throttle(3000, ([$messagingUrls, {messages}]) => {
      for (const url of $messagingUrls) {
        const filters: Filter[] = []

        if (messages) {
          filters.push({kinds: [WRAP], "#p": [$pubkey]})
        }

        sync(url, "messages", filters, [])
      }
    }),
  )

  signal.addEventListener("abort", () => {
    unsubscribeSpaces()
    unsubscribeMessages()
  })
}
