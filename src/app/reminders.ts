import {MINUTE, first, formatTimestampRelative, int, ms, now, uniq} from "@welshman/lib"
import {EVENT_RSVP, getIdFilters, isSignedEvent} from "@welshman/util"
import type {TrustedEvent} from "@welshman/util"
import {CalendarRsvp} from "@welshman/domain"
import {buildUrl} from "@lib/util"
import {getEventStart, getEventTitle, isAttending} from "@app/calendar"
import {app, network, reader, roomLists} from "@app/core"
import {PUSH_SERVER} from "@app/env"
import {notificationSettings, pushState} from "@app/push/adapters/common"

type Reminder = {
  at: number
  title: string
  body: string
}

const getScheduleUrl = () => {
  const {subscription} = pushState.get()

  return subscription && buildUrl(PUSH_SERVER, "subscription", subscription.key, "schedule")
}

const getLeadTimes = () => {
  const {events, reminder_minutes} = notificationSettings.get()

  return events ? uniq(reminder_minutes) : []
}

const makeReminders = (event: TrustedEvent, start: number): Reminder[] =>
  getLeadTimes()
    .map(minutes => ({
      at: start - int(minutes, MINUTE),
      title: getEventTitle(event) || "Upcoming event",
      body: `Starts ${formatTimestampRelative(now() + int(minutes, MINUTE))}`,
    }))
    .filter(({at}) => at > now())

const putSchedule = async (relay: string, event: TrustedEvent, reminders: Reminder[]) => {
  const url = getScheduleUrl()

  if (url) {
    const res = await fetch(url, {
      method: "PUT",
      headers: {Accept: "application/json", "Content-Type": "application/json"},
      body: JSON.stringify({
        id: event.id,
        relay,
        event: isSignedEvent(event) ? event : undefined,
        notifications: reminders,
      }),
    })

    if (!res.ok) {
      console.warn(`Failed to schedule event reminders (status ${res.status})`)
    }
  }
}

export const setEventReminders = (relay: string, event: TrustedEvent, attending: boolean) => {
  const start = getEventStart(event)

  return putSchedule(relay, event, attending && start ? makeReminders(event, start) : [])
}

const loadAttendedEvents = async (pubkey: string) => {
  const $network = network.get()
  const signal = AbortSignal.timeout(ms(10))
  const filters = [{kinds: [EVENT_RSVP], authors: [pubkey]}]
  const relays = roomLists.get().urls(pubkey).get()

  await $network.request({signal, filters, relays, autoClose: true})

  const {repository, tracker} = app.get()

  // An RSVP only goes to the space holding its event, so where it was seen is where the event is.
  const attended = repository.query(filters).flatMap(rsvp => {
    const rsvpReader = reader(CalendarRsvp)(rsvp)
    const address = rsvpReader.calendarEvent()
    const relay = first(Array.from(tracker.getRelays(rsvp.id)))

    return address && relay && isAttending(rsvpReader.status()) ? [{address, relay}] : []
  })

  await $network.request({
    signal,
    autoClose: true,
    relays: uniq(attended.map(({relay}) => relay)),
    filters: getIdFilters(attended.map(({address}) => address)),
  })

  return attended.flatMap(({address, relay}) => {
    const event = app.get().repository.getEvent(address)

    return event ? [{event, relay}] : []
  })
}

// Every schedule the push server holds was built from these settings, so redo the lot.
export const syncEventReminders = async () => {
  const url = getScheduleUrl()
  const pubkey = app.get().user?.pubkey

  if (url && pubkey) {
    const res = await fetch(url, {method: "DELETE"})

    if (!res.ok) {
      console.warn(`Failed to clear event reminders (status ${res.status})`)
    }

    if (getLeadTimes().length > 0) {
      for (const {event, relay} of await loadAttendedEvents(pubkey)) {
        await setEventReminders(relay, event, true)
      }
    }
  }
}
