import {synced, withGetter} from "@welshman/store"
import {kv} from "@app/core/storage"

export type AlertSettings = {
  push: boolean
  sound: boolean
  badge: boolean
  spaces: boolean
  mentions: boolean
  messages: boolean
  events: boolean
  reminder_minutes: number[]
}

export type AlertChannels = Pick<AlertSettings, "push" | "sound" | "badge">
export type AlertTypes = Pick<AlertSettings, "spaces" | "mentions" | "messages">

const defaultAlertSettings: AlertSettings = {
  push: false,
  sound: true,
  badge: false,
  spaces: true,
  mentions: true,
  messages: true,
  events: true,
  reminder_minutes: [5],
}

// The stored key predates the name, and moving it would drop everyone's settings.
export const alertSettings = withGetter(
  synced<AlertSettings>({
    key: "notificationSettings",
    storage: kv,
    defaultValue: defaultAlertSettings,
  }),
)

// synced restores the saved object whole, so fill in fields added since it was saved.
alertSettings.ready.then(() =>
  alertSettings.update(settings => ({...defaultAlertSettings, ...settings})),
)

export const setAlertChannels = (channels: Partial<AlertChannels>) =>
  alertSettings.update(settings => ({...settings, ...channels}))

export const setAlertTypes = (types: Partial<AlertTypes>) =>
  alertSettings.update(settings => ({...settings, ...types}))
