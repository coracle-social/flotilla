import type {Subscriber, Unsubscriber} from "svelte/store"
import {call, now, on} from "@welshman/lib"
import {matchFilters, MESSAGE, tagSpec, tagValue} from "@welshman/util"
import type {TrustedEvent} from "@welshman/util"
import type {RepositoryUpdate} from "@welshman/store"
import {DM_KINDS} from "@lib/util"
import {app} from "@app/core/app"
import {shouldNotify} from "@app/core/settings"
import {getEventAlertTypes} from "@app/features/alerts/policy"
import type {AlertType} from "@app/features/alerts/policy"
import {alertSettings} from "@app/features/alerts/settings"

// An event that raises an alert, with the alert types the user still has turned on.
export type Alert = {
  event: TrustedEvent
  types: AlertType[]
}

export const onAlert = call(() => {
  const subscribers: Subscriber<Alert>[] = []

  let unsubscribe: Unsubscriber | undefined

  return (f: (alert: Alert) => void) => {
    subscribers.push(f)

    if (!unsubscribe) {
      let unsubscribeRepository: Unsubscriber | undefined
      const unsubscribeApp = app.subscribe($app => {
        unsubscribeRepository?.()
        const filters = [{kinds: [MESSAGE, ...DM_KINDS], since: now()}]
        unsubscribeRepository = on($app.repository, "update", ({added}: RepositoryUpdate) => {
          const $pubkey = $app.user?.pubkey

          if (!$pubkey) {
            return
          }

          for (const event of added) {
            if (event.pubkey === $pubkey || !matchFilters(filters, event)) {
              continue
            }

            const h = tagValue(tagSpec("h"), event.tags)
            const notified = Array.from($app.repository.tracker.getRelays(event.id)).some(url =>
              shouldNotify(url, h),
            )

            if (notified) {
              const settings = alertSettings.get()
              const types = getEventAlertTypes(event, $pubkey).filter(type => settings[type])

              if (types.length > 0) {
                for (const f of subscribers) {
                  f({event, types})
                }
              }
            }
          }
        })
      })
      unsubscribe = () => {
        unsubscribeApp()
        unsubscribeRepository?.()
      }
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
