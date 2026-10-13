import {derived} from "svelte/store"
import {append, uniq} from "@welshman/lib"
import type {Maybe} from "@welshman/lib"
import {synced} from "@welshman/store"
import {Notify} from "@welshman/app"
import type {NotifyItem} from "@welshman/app"
import {fromApp} from "@app/core/app"
import {kv} from "@app/core/storage"

// A relay resends after every AUTH, so a dismissal is keyed on the message text.
const dismissedNotifies = synced<string[]>({
  key: "dismissedRelayNotifications",
  storage: kv,
  defaultValue: [],
})

const notifyKey = (notify: NotifyItem) => `${notify.url} ${notify.message}`

export const relayNotify = (url: string) =>
  derived(
    [fromApp($app => $app.use(Notify).one(url)), dismissedNotifies],
    ([$notify, $dismissed]) => {
      const shown = $notify && !$dismissed.includes(notifyKey($notify))

      return shown ? $notify : undefined
    },
  )

export const dismissRelayNotify = (notify: Maybe<NotifyItem>) =>
  notify &&
  dismissedNotifies.update($dismissed => uniq(append(notifyKey(notify), $dismissed)).slice(-100))
