import {MINUTE, first, formatTimestampRelative, int, ms, now, uniq} from "@welshman/lib"
import {EVENT_RSVP, EVENT_TIME, getAddress, getIdFilters, isSignedEvent} from "@welshman/util"
import type {TrustedEvent} from "@welshman/util"
import {CalendarRsvp, TimeEvent} from "@welshman/domain"
import {getEventStart, isAttending} from "@app/features/spaces/calendar"
import {app} from "@app/core/app"
import {network, roomLists} from "@app/core/plugins"
import {reader} from "@app/core/domain"
import {notificationSettings, pushState} from "@app/features/push/adapters/common"
import {deleteReminderSchedule, putReminderSchedule} from "@app/features/push/server"
import type {Reminder} from "@app/features/push/server"
import {pushToast} from "@app/features/toast"

const getLeadTimes = () => {
  const {events, reminder_minutes} = notificationSettings.get()

  return events ? uniq(reminder_minutes) : []
}

const makeReminders = (event: TrustedEvent, start: number): Reminder[] =>
  getLeadTimes()
    .map(minutes => ({
      at: start - int(minutes, MINUTE),
      title: reader(TimeEvent)(event).title() || "Upcoming event",
      body: `Starts ${formatTimestampRelative(now() + int(minutes, MINUTE))}`,
    }))
    .filter(({at}) => at > now())

const putSchedule = async (relay: string, event: TrustedEvent, reminders: Reminder[]) => {
  const {subscription} = pushState.get()

  if (subscription) {
    const res = await putReminderSchedule(subscription.key, {
      id: getAddress(event),
      relay,
      event: isSignedEvent(event) ? event : undefined,
      notifications: reminders,
    })

    if (!res.ok) {
      console.warn(`Failed to schedule event reminders (status ${res.status})`)
    }
  }
}

export const setEventReminders = async (relay: string, event: TrustedEvent, attending: boolean) => {
  const start = getEventStart(event)

  try {
    await putSchedule(relay, event, attending && start ? makeReminders(event, start) : [])
  } catch (e) {
    console.error(e)
    pushToast({theme: "error", message: "Your event reminders couldn't be set."})
  }
}

const isUpcoming = (event: TrustedEvent) => {
  const start = getEventStart(event)

  return Boolean(start && start > now())
}

const loadAttendedEvents = async (pubkey: string) => {
  const $network = network.get()
  const signal = AbortSignal.timeout(ms(10))
  const rsvpFilter = {kinds: [EVENT_RSVP], authors: [pubkey]}
  const hostedFilter = {kinds: [EVENT_TIME], authors: [pubkey]}
  const relays = roomLists.get().urls(pubkey).get()

  await $network.load({signal, relays, filters: [rsvpFilter, hostedFilter]})

  const {repository} = app.get()
  const getRelay = (event: TrustedEvent) =>
    first(Array.from(repository.tracker.getRelays(event.id)))
  const [storedRsvps, storedHosted] = await Promise.all([
    repository.query([rsvpFilter]),
    repository.query([hostedFilter]),
  ])

  // An RSVP only goes to the space holding its event, so where it was seen is where the event is.
  const rsvps = storedRsvps.flatMap(rsvp => {
    const rsvpReader = reader(CalendarRsvp)(rsvp)
    const address = rsvpReader.calendarEvent()
    const relay = getRelay(rsvp)

    return address && relay ? [{address, relay, attending: isAttending(rsvpReader.status())}] : []
  })

  const attended = rsvps.filter(({attending}) => attending)
  const answered = new Set(rsvps.map(({address}) => address))

  // A host attends their own event, unless they have answered its RSVP otherwise.
  const hosted = storedHosted.flatMap(event => {
    const relay = getRelay(event)

    return relay && !answered.has(getAddress(event)) ? [{event, relay}] : []
  })

  await $network.load({
    signal,
    relays: uniq(attended.map(({relay}) => relay)),
    filters: getIdFilters(attended.map(({address}) => address)),
  })

  const rsvped = await Promise.all(
    attended.map(async ({address, relay}) => {
      const event = await repository.getEvent(address)

      return event ? [{event, relay}] : []
    }),
  )

  return [...rsvped.flat(), ...hosted].filter(({event}) => isUpcoming(event))
}

// Every schedule the push server holds was built from these settings, so redo the lot.
export const syncEventReminders = async () => {
  const {subscription} = pushState.get()
  const pubkey = app.get().user?.pubkey

  if (subscription && pubkey) {
    const res = await deleteReminderSchedule(subscription.key)

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
