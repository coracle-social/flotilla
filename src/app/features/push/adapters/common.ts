import {ms, parseJson, poll, throttle} from "@welshman/lib"
import {LOCAL_RELAY_URL} from "@welshman/net"
import {getIdFilters, verifyEvent, WRAP} from "@welshman/util"
import type {Filter, TrustedEvent} from "@welshman/util"
import {merged} from "@welshman/store"
import {User} from "@welshman/app"
import {app} from "@app/core/app"
import {messagingRelayLists, network, roomLists} from "@app/core/plugins"
import {userSettingsValues} from "@app/core/settings"
import {alertSettings, getMessageAlertFilters, getSpaceAlertFilters} from "@app/features/alerts"
import type {PushPermission} from "@app/features/push/permission"
import {goToMessages} from "@app/features/messages"
import {navigate} from "@app/navigation/navigate"
import {getEventPath} from "@app/navigation/locations"
import {goToSpace} from "@app/navigation/history"

export interface IPushAdapter {
  check: () => Promise<PushPermission>
  request: () => Promise<PushPermission>
  disable: () => Promise<void>
  enable: () => Promise<void>
}

const ingestNotification = async (relay: string, id: string, json?: string) => {
  const pushed = parseJson<TrustedEvent>(json)

  if (pushed && verifyEvent(pushed)) {
    await app.get().ingestEvent(pushed, relay)

    return pushed
  } else {
    const events = await network.get().load({
      filters: getIdFilters([id]),
      relays: [relay, LOCAL_RELAY_URL],
      // The local relay eoses immediately, so anything less waits on it alone
      threshold: 1,
      signal: AbortSignal.timeout(ms(5)),
    })

    return events[0]
  }
}

// Wraps are ingested into the repository and unwrapped in the background, so wait for the rumor
const loadNotificationRumor = async (wrap: TrustedEvent) => {
  const {wrapManager} = app.get()

  await poll({condition: () => wrapManager.hasWrap(wrap.id), signal: AbortSignal.timeout(ms(5))})

  return wrapManager.getRumor(wrap.id)
}

export const onPushNotificationAction = async (action: {
  notification: {data: {relay: string; id: string; event?: string}}
}) => {
  const {relay, id, event: json} = action.notification.data
  const event = await ingestNotification(relay, id, json)
  const target = event?.kind === WRAP ? await loadNotificationRumor(event) : event
  const path = target && getEventPath(target, [relay])

  if (path) {
    navigate(path)
  } else if (event?.kind === WRAP) {
    goToMessages()
  } else {
    goToSpace(relay)
  }
}

// NIP-9a: asks a relay to post matching events to the push server's callback
export const syncRelaySubscriptions = (
  signal: AbortSignal,
  sync: (url: string, key: string, filters: Filter[], ignore: Filter[]) => void,
) => {
  const $pubkey = User.require(app.get()).pubkey

  const unsubscribeSpaces = merged([
    roomLists.get().urls($pubkey).$,
    alertSettings,
    userSettingsValues,
  ]).subscribe(
    throttle(3000, ([$spaceUrls, $types, $settings]) => {
      for (const url of $spaceUrls) {
        const {include, ignore} = getSpaceAlertFilters({
          url,
          types: $types,
          settings: $settings,
          pubkey: $pubkey,
        })

        sync(url, "spaces", include, ignore)
      }
    }),
  )

  const unsubscribeMessages = merged([
    messagingRelayLists.get().urls($pubkey).$,
    alertSettings,
  ]).subscribe(
    throttle(3000, ([$messagingUrls, $types]) => {
      for (const url of $messagingUrls) {
        sync(url, "messages", getMessageAlertFilters($types, $pubkey), [])
      }
    }),
  )

  signal.addEventListener("abort", () => {
    unsubscribeSpaces()
    unsubscribeMessages()
  })
}
