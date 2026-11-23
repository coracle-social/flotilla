import {derived} from "svelte/store"
import {
  countBy,
  formatTimestampAsTime,
  LOCALE,
  ms,
  now,
  removeUndefined,
  secondsToDate,
  sortBy,
  uniqBy,
} from "@welshman/lib"
import type {Maybe} from "@welshman/lib"
import {getIdAndAddress, getIdFilters} from "@welshman/util"
import type {TrustedEvent} from "@welshman/util"
import {Events} from "@welshman/app"
import type {IApp} from "@welshman/app"
import {observeEventsById, synced, throttled} from "@welshman/store"
import {app} from "@app/core/app"
import {kv} from "@app/core/storage"
import {latestActivityByPath, unreadPaths} from "@app/tools/activity"
import {checked, isChecked, setChecked} from "@app/tools/checked"
import {isEventMuted} from "@app/tools/people/muting"
import {
  getActivityFacet,
  getActivityFilters,
  getChatItems,
  getNoteItems,
  getNoteRef,
  getSpaceItems,
  isActivity,
} from "@app/areas/home/activity/model"
import type {ActivityFacet, ActivityItem} from "@app/areas/home/activity/model"
import {makeNoteResolver} from "@app/tools/notes"
import type {NoteResolver} from "@app/tools/notes"

export const includedActivityFacets = synced<ActivityFacet[]>({
  key: "includedHomeActivityTypes",
  defaultValue: ["spaces", "replies", "reactions", "zaps"],
  storage: kv,
})

// The stream is no route of its own, so what has been read sits under a path nothing navigates to.
const activityPath = "/home/notifications"

export const readActivity = () => setChecked(activityPath)

const shortDate = (ts: number) =>
  Intl.DateTimeFormat(LOCALE, {dateStyle: "short"}).format(secondsToDate(ts))

export const displayActivityTimestamp = (ts: number) =>
  shortDate(ts) === shortDate(now()) ? formatTimestampAsTime(ts) : shortDate(ts)

// Everything that tags the user, before the notes it is about have loaded.
const taggedEvents = derived(
  app,
  ($app, set) => {
    const pubkey = $app.user?.pubkey

    if (pubkey) {
      return $app.use(Events).desc(getActivityFilters(pubkey)).$.subscribe(set)
    }

    set([])
  },
  [] as TrustedEvent[],
)

let noteLoader: Maybe<{app: IApp; resolver: NoteResolver}>

// An app is scoped to one identity, so a login starts the bookkeeping over.
const getNoteResolver = ($app: IApp) => {
  if (noteLoader?.app === $app) {
    return noteLoader.resolver
  }

  noteLoader?.resolver.stop()

  const resolver = makeNoteResolver({batchSize: 100, maxAttempts: 2})

  noteLoader = {app: $app, resolver}

  return resolver
}

// Asks for every note on each arrival, since the resolver retries a miss only when asked, and emits the set as a string.
const noteKeys = derived([app, throttled(ms(1), taggedEvents)], ([$app, $events]) => {
  const refs = uniqBy(ref => ref.getAddressOrId(), removeUndefined($events.map(getNoteRef)))

  if (refs.length > 0) {
    getNoteResolver($app).resolve(refs.map(ref => ({ref})))
  }

  return JSON.stringify(removeUndefined(refs.map(ref => ref.getAddressOrId())))
})

// A ref names its note by id or by address, so the map answers to either.
const indexNotes = (events: TrustedEvent[]) =>
  new Map(
    events.flatMap(event =>
      getIdAndAddress(event).map((key): [string, TrustedEvent] => [key, event]),
    ),
  )

// A string only changes with the set, so a reaction to a note already here reopens nothing.
const notes = derived(
  [app, noteKeys],
  ([$app, $noteKeys], set) => {
    const keys: string[] = JSON.parse($noteKeys)

    if (keys.length > 0) {
      return observeEventsById({
        repository: $app.repository,
        filters: getIdFilters(keys),
        onEvents: $byId => set(indexNotes([...$byId.values()])),
      })
    }

    set(new Map())
  },
  new Map<string, TrustedEvent>(),
)

const activityEvents = derived(
  [app, taggedEvents, notes, isEventMuted],
  ([$app, $events, $notes, $isEventMuted]) =>
    $events.filter(event => {
      const key = getNoteRef(event)?.getAddressOrId()

      if (key) {
        return isActivity(event, $notes.get(key), {
          pubkey: $app.user?.pubkey ?? "",
          isMuted: $isEventMuted,
        })
      }

      return false
    }),
)

// Mentions have no filter chip, so they always show.
const includedEvents = derived([activityEvents, includedActivityFacets], ([$events, $facets]) =>
  $events.filter(event => {
    const facet = getActivityFacet(event)

    return facet === "mentions" || $facets.includes(facet)
  }),
)

export const activityUnread = derived(
  [includedEvents, checked],
  ([$events, $checked]) =>
    $events.length > 0 && !isChecked($checked, activityPath, $events[0].created_at),
)

const chatsAndSpaces = derived(
  [latestActivityByPath, unreadPaths],
  ([$latestActivityByPath, $unreadPaths]) => {
    const activity = [...$latestActivityByPath.values()]

    return {chats: getChatItems(activity), spaces: getSpaceItems(activity, $unreadPaths)}
  },
)

// Every row the filters let through, newest first.
export const activityItems = derived(
  [chatsAndSpaces, includedEvents, notes, includedActivityFacets],
  ([{chats, spaces}, $includedEvents, $notes, $facets]) => {
    const includeSpaces = $facets.includes("spaces")
    // A direct message has no url, so the spaces filter never hides it, and 12 chats show what is going on.
    const items: ActivityItem[] = chats
      .filter(item => includeSpaces || !item.activity.url)
      .slice(0, 12)

    if (includeSpaces) {
      items.push(...spaces)
    }

    items.push(...getNoteItems($includedEvents, $notes))

    return sortBy(item => -item.timestamp, items)
  },
)

export const activityCounts = derived(
  [chatsAndSpaces, activityEvents],
  ([{chats, spaces}, $events]) =>
    new Map<ActivityFacet, number>([
      ...countBy(getActivityFacet, $events),
      ["spaces", chats.filter(item => item.activity.url).length + spaces.length],
    ]),
)
