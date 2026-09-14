import {
  HOUR,
  LOCALE,
  dateToSeconds,
  int,
  pushToMapKey,
  secondsToDate,
  sortBy,
  uniqBy,
} from "@welshman/lib"
import {EVENT_RSVP, getAddress, makeEvent, tagSpec, tagValue} from "@welshman/util"
import type {TrustedEvent} from "@welshman/util"
import {TimeEvent} from "@welshman/domain"
import {synced} from "@welshman/store"
import {deletes, reader, relays, thunks} from "@app/core"
import {deriveEvents} from "@app/repository"
import {PROTECTED, ROOM} from "@app/rooms"
import {kv} from "@app/storage"

// Views

export type CalendarView = "agenda" | "week" | "month"

// People tend to stick with one way of reading a calendar, so open it the way they left it
export const calendarView = synced<CalendarView>({
  key: "calendarView",
  defaultValue: "month",
  storage: kv,
})

// Dates

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate())

export const addDays = (date: Date, days: number) => {
  const result = startOfDay(date)

  result.setDate(result.getDate() + days)

  return result
}

export const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate()

const startOfWeek = (date: Date) => addDays(date, -date.getDay())

export const isToday = (date: Date) => isSameDay(date, new Date())

export const isCurrentMonth = (date: Date) => {
  const today = new Date()

  return date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth()
}

export const isCurrentWeek = (date: Date) => isSameDay(startOfWeek(date), startOfWeek(new Date()))

// Six rows so the grid's height doesn't change from month to month
export const getMonthDays = (date: Date) => {
  const start = startOfWeek(new Date(date.getFullYear(), date.getMonth(), 1))

  return Array.from({length: 42}, (_, index) => addDays(start, index))
}

export const getWeekDays = (date: Date) => {
  const start = startOfWeek(date)

  return Array.from({length: 7}, (_, index) => addDays(start, index))
}

export const addMonths = (date: Date, months: number) =>
  new Date(date.getFullYear(), date.getMonth() + months, 1)

export const makeDayKey = (date: Date) =>
  `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`

export const formatMonth = (date: Date) =>
  Intl.DateTimeFormat(LOCALE, {month: "long", year: "numeric"}).format(date)

export const formatWeekday = (date: Date) =>
  Intl.DateTimeFormat(LOCALE, {weekday: "short"}).format(date)

export const formatDay = (date: Date) =>
  Intl.DateTimeFormat(LOCALE, {weekday: "long", month: "long", day: "numeric"}).format(date)

export const formatWeekRange = (date: Date) => {
  const days = getWeekDays(date)
  const first = Intl.DateTimeFormat(LOCALE, {month: "short", day: "numeric"}).format(days[0])
  const last = Intl.DateTimeFormat(LOCALE, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(days[6])

  return `${first} – ${last}`
}

// A day picked out of a grid carries no time of day, so start it at a neutral hour
export const makeDayRange = (day: Date) => {
  const start = dateToSeconds(new Date(day.getFullYear(), day.getMonth(), day.getDate(), 12))

  return {start, end: start + int(1, HOUR)}
}

// Calendar events

export const getEventStart = (event: TrustedEvent) => reader(TimeEvent)(event).start()

// NIP-52 settled on `title`, but events from before that still carry `name`.
export const getEventTitle = (event: TrustedEvent) =>
  reader(TimeEvent)(event).title() ?? tagValue(tagSpec("name"), event.tags)

// An event covering several days is only introduced on the first of them; the rest continue it.
export const startsOnDay = (event: TrustedEvent, day: Date) => {
  const start = getEventStart(event)

  return Boolean(start && isSameDay(secondsToDate(start), day))
}

// Multi-day events show up on each day they cover, in start order within each day. A malformed
// end date could span an unbounded number of days, so stop after a year.
export const groupEventsByDay = (events: TrustedEvent[]) => {
  const result = new Map<string, TrustedEvent[]>()

  for (const event of events) {
    const timeEvent = reader(TimeEvent)(event)
    const start = timeEvent.start()

    if (start) {
      const lastDay = startOfDay(secondsToDate(timeEvent.end() ?? start))

      let day = startOfDay(secondsToDate(start))

      for (let index = 0; day <= lastDay && index < 366; index++) {
        pushToMapKey(result, makeDayKey(day), event)
        day = addDays(day, 1)
      }
    }
  }

  for (const [key, dayEvents] of result) {
    result.set(
      key,
      sortBy(event => getEventStart(event) ?? 0, dayEvents),
    )
  }

  return result
}

// Whether an event spans more than one calendar day — see layoutMultiDayBars.
export const isMultiDayEvent = (event: TrustedEvent) => {
  const timeEvent = reader(TimeEvent)(event)
  const start = timeEvent.start()

  if (!start) {
    return false
  }

  return !isSameDay(secondsToDate(start), secondsToDate(timeEvent.end() ?? start))
}

export const getSingleDayEvents = (events: TrustedEvent[]) =>
  events.filter(event => !isMultiDayEvent(event))

export type CalendarBar = {
  event: TrustedEvent
  startCol: number
  span: number
  lane: number
  continuesBefore: boolean
  continuesAfter: boolean
}

const daysApart = (a: Date, b: Date) =>
  Math.round((a.getTime() - b.getTime()) / (24 * 60 * 60 * 1000))

// Lays multi-day events spanning `days` out as bars instead of a chip per day, packing
// overlapping ones into as few vertical lanes as possible.
export const layoutMultiDayBars = (
  days: Date[],
  eventsByDay: Map<string, TrustedEvent[]>,
): CalendarBar[] => {
  const windowStart = days[0]
  const windowEnd = days[days.length - 1]
  const seen = new Set<string>()
  const spans: Omit<CalendarBar, "lane">[] = []

  for (const day of days) {
    for (const event of eventsByDay.get(makeDayKey(day)) ?? []) {
      if (seen.has(event.id) || !isMultiDayEvent(event)) {
        continue
      }

      seen.add(event.id)

      const timeEvent = reader(TimeEvent)(event)
      const start = timeEvent.start()!
      const eventStart = startOfDay(secondsToDate(start))
      const eventEnd = startOfDay(secondsToDate(timeEvent.end() ?? start))
      const startCol = Math.max(0, daysApart(eventStart, windowStart))
      const endCol = Math.min(days.length - 1, daysApart(eventEnd, windowStart))

      spans.push({
        event,
        startCol,
        span: endCol - startCol + 1,
        continuesBefore: eventStart < windowStart,
        continuesAfter: eventEnd > windowEnd,
      })
    }
  }

  const laneEnds: number[] = []
  const bars: CalendarBar[] = []

  for (const span of sortBy(s => s.startCol, spans)) {
    let lane = laneEnds.findIndex(end => end < span.startCol)

    if (lane === -1) {
      lane = laneEnds.length
    }

    laneEnds[lane] = span.startCol + span.span - 1
    bars.push({...span, lane})
  }

  return bars
}

// RSVPs (NIP-52)

export enum RsvpStatus {
  Accepted = "accepted",
  Declined = "declined",
  Tentative = "tentative",
}

export const makeRsvpFilter = (event: TrustedEvent) => ({
  kinds: [EVENT_RSVP],
  "#a": [getAddress(event)],
})

export const deriveRsvps = (event: TrustedEvent) => deriveEvents([makeRsvpFilter(event)])

export const getRsvpStatus = (rsvp: TrustedEvent) => tagValue(tagSpec("status"), rsvp.tags)

// An RSVP replaces the sender's previous one, but a relay can still be holding both, so the
// newest per person is the one that counts.
export const getRsvpsByStatus = (rsvps: TrustedEvent[]) => {
  const latest = uniqBy(
    rsvp => rsvp.pubkey,
    sortBy(rsvp => -rsvp.created_at, rsvps),
  )

  const byStatus = (status: RsvpStatus) =>
    latest.filter(rsvp => getRsvpStatus(rsvp) === status).map(rsvp => rsvp.pubkey)

  return {
    latest,
    accepted: byStatus(RsvpStatus.Accepted),
    tentative: byStatus(RsvpStatus.Tentative),
    declined: byStatus(RsvpStatus.Declined),
  }
}

// An RSVP is addressable, so identifying it by its target makes a new one supersede the old.
export const publishRsvp = async (url: string, event: TrustedEvent, status: RsvpStatus) => {
  const address = getAddress(event)
  const h = tagValue(tagSpec(ROOM), event.tags)
  const tags = [
    ["a", address, url],
    ["e", event.id, url],
    ["d", address],
    ["status", status],
    ["p", event.pubkey],
  ]

  if (await relays.get().hasNip(url, 70)) {
    tags.push(PROTECTED)
  }

  if (h) {
    tags.push([ROOM, h])
  }

  return thunks.get().publish({relays: [url], event: makeEvent(EVENT_RSVP, {tags})})
}

export const retractRsvp = async (url: string, rsvp: TrustedEvent) => {
  const protect = await relays.get().hasNip(url, 70)
  const command = await deletes.get().deleteEvent(rsvp, writer => writer.setProtected(protect))

  return command.publishToRelays([url])
}
