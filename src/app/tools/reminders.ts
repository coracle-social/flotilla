import {MINUTE, formatTimestampRelative, int, now, uniq} from "@welshman/lib"
import {getIdOrAddress, isSignedEvent} from "@welshman/util"
import type {TrustedEvent} from "@welshman/util"
import {merged} from "@welshman/store"
import {app} from "@app/core/app"
import {alertSettings} from "@app/tools/alerts/settings"
import type {AlertSettings} from "@app/tools/alerts/settings"
import {deleteReminderSchedule, putReminderSchedule} from "@app/tools/push/server"
import type {Reminder} from "@app/tools/push/server"
import {pushRegistration} from "@app/tools/push/registration"
import {pushToast} from "@app/navigation/toast"

// Something the user can be reminded of: when it starts, and what to call it.
export type Upcoming = {event: TrustedEvent; relay: string; start: number; title: string}

export type ReminderSource = {
  isEnabled: (settings: AlertSettings) => boolean
  load: (pubkey: string) => Promise<Upcoming[]>
}

const sources: ReminderSource[] = []

export const registerReminders = (source: ReminderSource) => {
  sources.push(source)
}

const makeReminders = ({start, title}: Upcoming): Reminder[] =>
  uniq(alertSettings.get().reminder_minutes)
    .map(minutes => ({
      at: start - int(minutes, MINUTE),
      title,
      body: `Starts ${formatTimestampRelative(now() + int(minutes, MINUTE))}`,
    }))
    .filter(({at}) => at > now())

const putSchedule = async (
  {event, relay}: Pick<Upcoming, "event" | "relay">,
  reminders: Reminder[],
) => {
  const {subscription} = pushRegistration.get()

  if (subscription) {
    try {
      const res = await putReminderSchedule(subscription.key, {
        id: getIdOrAddress(event),
        relay,
        event: isSignedEvent(event) ? event : undefined,
        notifications: reminders,
      })

      if (!res.ok) {
        console.warn(`Failed to schedule reminders (status ${res.status})`)
      }
    } catch (e) {
      console.error(e)
      pushToast({theme: "error", message: "Your reminders couldn't be set."})
    }
  }
}

export const scheduleReminders = (upcoming: Upcoming) =>
  putSchedule(upcoming, makeReminders(upcoming))

export const clearReminders = (target: Pick<Upcoming, "event" | "relay">) => putSchedule(target, [])

const rebuildReminders = async () => {
  const {subscription} = pushRegistration.get()
  const pubkey = app.get().user?.pubkey

  if (subscription && pubkey) {
    const res = await deleteReminderSchedule(subscription.key)

    if (!res.ok) {
      console.warn(`Failed to clear reminders (status ${res.status})`)
    }

    const settings = alertSettings.get()

    if (settings.reminder_minutes.length > 0) {
      for (const source of sources.filter(source => source.isEnabled(settings))) {
        for (const upcoming of await source.load(pubkey)) {
          await scheduleReminders(upcoming)
        }
      }
    }
  }
}

// Every schedule the push server holds was built from these settings, so rebuild them on any change.
export const syncReminders = () => {
  let syncedFor: string | undefined

  return merged([pushRegistration, alertSettings]).subscribe(([{subscription}, settings]) => {
    const enabled = sources.map(source => source.isEnabled(settings))
    const next = JSON.stringify([subscription?.key, settings.reminder_minutes, enabled])

    if (next !== syncedFor) {
      syncedFor = next
      rebuildReminders().catch(console.error)
    }
  })
}
