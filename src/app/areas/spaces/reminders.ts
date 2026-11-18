import {first, ms, now, uniq} from "@welshman/lib"
import {EVENT_RSVP, EVENT_TIME, getAddress, getIdFilters} from "@welshman/util"
import type {TrustedEvent} from "@welshman/util"
import {CalendarRsvp, TimeEvent} from "@welshman/domain"
import {app} from "@app/core/app"
import {network, roomLists} from "@app/core/plugins"
import {reader} from "@app/core/domain"
import {alertSettings} from "@app/tools/alerts/settings"
import {clearReminders, scheduleReminders} from "@app/tools/reminders"
import type {ReminderSource, Upcoming} from "@app/tools/reminders"
import {getEventStart, isAttending} from "@app/areas/spaces/calendar"

const getEventTitle = (event: TrustedEvent) => reader(TimeEvent)(event).title() || "Upcoming event"

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

  return [...rsvped.flat(), ...hosted].flatMap(({event, relay}): Upcoming[] => {
    const start = getEventStart(event)

    return start && start > now() ? [{event, relay, start, title: getEventTitle(event)}] : []
  })
}

export const calendarReminders: ReminderSource = {
  isEnabled: settings => settings.events,
  load: loadAttendedEvents,
}

export const setEventReminders = async (relay: string, event: TrustedEvent, attending: boolean) => {
  const start = getEventStart(event)

  if (attending && start && calendarReminders.isEnabled(alertSettings.get())) {
    await scheduleReminders({event, relay, start, title: getEventTitle(event)})
  } else {
    await clearReminders({event, relay})
  }
}
