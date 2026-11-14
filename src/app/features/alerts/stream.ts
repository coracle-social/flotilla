import {noop, now} from "@welshman/lib"
import type {Maybe} from "@welshman/lib"
import {MESSAGE, tagSpec, tagValue} from "@welshman/util"
import type {TrustedEvent} from "@welshman/util"
import type {IApp} from "@welshman/app"
import type {RepositoryUpdate, Unsubscriber} from "@welshman/store"
import {DM_KINDS} from "@lib/util"
import {app} from "@app/core/app"
import {shouldNotify} from "@app/core/settings"
import {getAlertTypes} from "@app/features/alerts/policy"
import type {AlertType} from "@app/features/alerts/policy"
import {alertSettings} from "@app/features/alerts/settings"

export type Alert = {event: TrustedEvent; types: AlertType[]}

type Subscriber = (alert: Alert) => void

const subscribers = new Set<Subscriber>()

const notify = (alert: Alert) => {
  for (const subscriber of subscribers) {
    subscriber(alert)
  }
}

const onUpdate = ($app: IApp, {added}: RepositoryUpdate) => {
  const pubkey = $app.user?.pubkey

  if (pubkey) {
    for (const event of added) {
      if (event.pubkey !== pubkey) {
        const h = tagValue(tagSpec("h"), event.tags)
        const relays = $app.repository.tracker.getRelays(event.id)

        if (Array.from(relays).some(url => shouldNotify(url, h))) {
          const types = getAlertTypes(event, pubkey).filter(type => alertSettings.get()[type])

          if (types.length > 0) {
            notify({event, types})
          }
        }
      }
    }
  }
}

const start = (): Unsubscriber => {
  let stopObserving: Unsubscriber = noop

  const unsubscribeApp = app.subscribe($app => {
    stopObserving()

    stopObserving = $app.repository.observe({
      // `since` is taken here and `onLoad` is ignored, so only events arriving from now on alert.
      filters: [{kinds: [MESSAGE, ...DM_KINDS], since: now()}],
      onLoad: noop,
      onUpdate: update => onUpdate($app, update),
    })
  })

  return () => {
    unsubscribeApp()
    stopObserving()
  }
}

let stopSharing: Maybe<Unsubscriber>

export const onAlert = (subscriber: Subscriber): Unsubscriber => {
  subscribers.add(subscriber)

  if (subscribers.size === 1) {
    stopSharing = start()
  }

  return () => {
    subscribers.delete(subscriber)

    if (subscribers.size === 0) {
      stopSharing?.()
      stopSharing = undefined
    }
  }
}
