import {ms, parseJson, poll} from "@welshman/lib"
import {LOCAL_RELAY_URL} from "@welshman/net"
import {getIdFilters, verifyEvent, WRAP} from "@welshman/util"
import type {TrustedEvent} from "@welshman/util"
import {app} from "@app/core/app"
import {network} from "@app/core/plugins"
import {navigate} from "@app/navigation/navigate"
import {getEventPath} from "@app/navigation/locations"
import {goToMessages, goToSpace} from "@app/navigation/history"

const ingestNotification = async (relay: string, id: string, json?: string) => {
  const pushed = parseJson<TrustedEvent>(json)

  if (pushed && verifyEvent(pushed)) {
    await app.get().ingestEvent(pushed, relay)

    return pushed
  }

  const events = await network.get().load({
    filters: getIdFilters([id]),
    relays: [relay, LOCAL_RELAY_URL],
    // The local relay closes immediately, so anything less waits on it alone
    threshold: 1,
    signal: AbortSignal.timeout(ms(5)),
  })

  return events[0]
}

// Wraps are ingested into the repository and unwrapped in the background, so wait for the rumor
const loadNotificationRumor = async (wrap: TrustedEvent) => {
  const {wrapManager} = app.get()

  await poll({condition: () => wrapManager.hasWrap(wrap.id), signal: AbortSignal.timeout(ms(5))})

  return wrapManager.getRumor(wrap.id)
}

type NotificationAction = {
  relay: string
  id: string
  event?: string
}

export const onPushNotificationAction = async ({relay, id, event: json}: NotificationAction) => {
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
