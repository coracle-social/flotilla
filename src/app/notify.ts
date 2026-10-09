import {derived} from "svelte/store"
import {append, uniq} from "@welshman/lib"
import type {Maybe} from "@welshman/lib"
import {synced} from "@welshman/store"
import {Notify} from "@welshman/app"
import type {NotifyItem} from "@welshman/app"
import {fromApp} from "@app/core"
import {kv} from "@app/storage"

// A relay resends after every AUTH, so a dismissal is keyed on the message text.
const dismissedRelayNotifications = synced<string[]>({
  key: "dismissedRelayNotifications",
  storage: kv,
  defaultValue: [],
})

const notificationKey = (notification: NotifyItem) => `${notification.url} ${notification.message}`

export const relayNotification = (url: string) =>
  derived(
    [fromApp($app => $app.use(Notify).one(url)), dismissedRelayNotifications],
    ([$notification, $dismissed]) => {
      const shown = $notification && !$dismissed.includes(notificationKey($notification))

      return shown ? $notification : undefined
    },
  )

export const dismissRelayNotification = (notification: Maybe<NotifyItem>) =>
  notification &&
  dismissedRelayNotifications.update($dismissed =>
    uniq(append(notificationKey(notification), $dismissed)).slice(-100),
  )
