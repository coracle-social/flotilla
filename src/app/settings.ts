import type {Writable} from "svelte/store"
import {derived, writable} from "svelte/store"
import {append, equals, remove, spec} from "@welshman/lib"
import {APP_DATA} from "@welshman/util"
import {withGetter} from "@welshman/store"
import {AppData} from "@welshman/domain"
import type {AppDataReader} from "@welshman/domain"
import {DerivedPlugin, Domain, Network, User, projectFrom} from "@welshman/app"
import type {IApp, Projection} from "@welshman/app"
import {app, fromApp, usePlugin} from "@app/core"

export const SETTINGS = "flotilla/settings"

export enum RelayAuthMode {
  Aggressive = "aggressive",
  Conservative = "conservative",
}

export type SpaceNotificationSettings = {
  url: string
  notify: boolean
  exceptions: string[]
  // Absent in settings published before muting existed
  muted?: string[]
}

export type SettingsValues = {
  show_media: boolean
  hide_sensitive: boolean
  trusted_relays: string[]
  report_usage: boolean
  relay_auth: RelayAuthMode
  send_delay: number
  font_size: number
  alerts: SpaceNotificationSettings[]
  zap_amounts: number[]
  openrouter_key: string
  min_dm_pow: number
  min_dm_wot: number
}

export const defaultSettings: SettingsValues = {
  show_media: true,
  hide_sensitive: true,
  trusted_relays: [],
  report_usage: true,
  relay_auth: RelayAuthMode.Conservative,
  send_delay: 0,
  font_size: 1.1,
  alerts: [],
  zap_amounts: [21, 210, 2100, 21000],
  openrouter_key: "",
  min_dm_pow: 16,
  min_dm_wot: 3,
}

export class Settings extends DerivedPlugin<AppDataReader> {
  values: Projection<SettingsValues>

  constructor(app: IApp) {
    super(app, {
      filters: [{kinds: [APP_DATA], "#d": [SETTINGS]}],
      eventToItem: app.use(Domain).reader(AppData),
      getKey: settings => settings.author(),
    })

    this.values = projectFrom(this.index, $settings => ({
      ...defaultSettings,
      ...$settings.get(app.user?.pubkey ?? "")?.values<Partial<SettingsValues>>(),
    }))
  }

  fetch(pubkey: string) {
    return this.app.use(Network).loadUsingOutbox(pubkey, {kinds: [APP_DATA], "#d": [SETTINGS]})
  }
}

export const settings = usePlugin(Settings)

export const userSettingsValues = withGetter(fromApp($app => $app.use(Settings).values.$))

// Settings arrive from an encrypted APP_DATA event, so the form adopts them while it is still pristine.
export const createSettingsForm = (): Writable<SettingsValues> => {
  let current = {...userSettingsValues.get()}
  let baseline = userSettingsValues.get()

  const store = writable(current, set =>
    userSettingsValues.subscribe($settings => {
      if ($settings !== baseline) {
        if (equals(current, baseline)) {
          current = {...$settings}
          set(current)
        }

        baseline = $settings
      }
    }),
  )

  return {
    subscribe: store.subscribe,
    set(value) {
      current = value
      store.set(value)
    },
    update(fn) {
      current = fn(current)
      store.set(current)
    },
  }
}

export const zapAmounts = derived(userSettingsValues, $settings => $settings.zap_amounts)

export const getSetting = <K extends keyof SettingsValues>(key: K) => userSettingsValues.get()[key]

export const getMutedRooms = ({alerts}: SettingsValues, url: string) =>
  alerts.find(spec({url}))?.muted ?? []

export const getIsMuted = (settings: SettingsValues, url: string, h: string) =>
  getMutedRooms(settings, url).includes(h)

export const deriveIsMuted = (url: string, h: string) =>
  derived(userSettingsValues, $settings => getIsMuted($settings, url, h))

// Ignores mute, so a room's preference survives being muted and comes back as it was.
export const getNotifyPreference = ({alerts}: SettingsValues, url: string, h?: string) => {
  const pref = alerts.find(spec({url}))

  if (!pref) {
    return true
  }
  if (!h) {
    return pref.notify
  }

  return pref.notify ? !pref.exceptions.includes(h) : pref.exceptions.includes(h)
}

// Muting forces notifications off, and this is only editable while the room is not muted.
export const getShouldNotify = (settings: SettingsValues, url: string, h?: string) =>
  h && getIsMuted(settings, url, h) ? false : getNotifyPreference(settings, url, h)

export const shouldNotify = (url: string, h?: string) =>
  getShouldNotify(userSettingsValues.get(), url, h)

export const deriveShouldNotify = (url: string, h?: string) =>
  derived(userSettingsValues, $settings => getShouldNotify($settings, url, h))

export const notificationSettings = withGetter(
  writable({
    push: false,
    sound: true,
    badge: false,
    spaces: true,
    mentions: true,
    messages: true,
  }),
)

export const publishSettings = async (params: Partial<SettingsValues>) => {
  const $app = app.get()
  const reader = await settings.get().forceLoad(User.require($app).pubkey)
  const writer = $app
    .use(Domain)
    .writer(AppData, reader)
    .setIdentifier(SETTINGS)
    .setEncrypted(true)
    .setValues({...userSettingsValues.get(), ...params})

  const command = await $app.use(Domain).command(writer)

  return command.publish()
}

export const addTrustedRelay = (url: string) =>
  publishSettings({trusted_relays: append(url, getSetting("trusted_relays"))})

export const removeTrustedRelay = (url: string) =>
  publishSettings({trusted_relays: remove(url, getSetting("trusted_relays"))})

export const setSpaceNotifications = (url: string, notify: boolean) => {
  const alerts = getSetting("alerts")
  const existing = alerts.find(spec({url}))

  if (existing) {
    return publishSettings({
      alerts: alerts.map(s => (s.url === url ? {...s, notify, exceptions: []} : s)),
    })
  }

  return publishSettings({alerts: [...alerts, {url, notify, exceptions: []}]})
}

export const toggleRoomNotifications = (url: string, h: string) => {
  const alerts = getSetting("alerts")
  const existing = alerts.find(spec({url}))

  if (existing) {
    const exceptions = existing.exceptions.includes(h)
      ? remove(h, existing.exceptions)
      : append(h, existing.exceptions)

    return publishSettings({alerts: alerts.map(s => (s.url === url ? {...s, exceptions} : s))})
  }

  return publishSettings({alerts: [...alerts, {url, notify: true, exceptions: [h]}]})
}

export const toggleRoomMuted = (url: string, h: string) => {
  const alerts = getSetting("alerts")
  const existing = alerts.find(spec({url}))

  if (existing) {
    const current = existing.muted ?? []
    const muted = current.includes(h) ? remove(h, current) : append(h, current)

    return publishSettings({alerts: alerts.map(s => (s.url === url ? {...s, muted} : s))})
  }

  return publishSettings({alerts: [...alerts, {url, notify: true, exceptions: [], muted: [h]}]})
}
