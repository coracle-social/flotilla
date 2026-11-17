import {derived} from "svelte/store"
import {ms, removeUndefined, uniqBy} from "@welshman/lib"
import type {Maybe} from "@welshman/lib"
import {getIdAndAddress, getIdFilters} from "@welshman/util"
import type {TrustedEvent} from "@welshman/util"
import {Events} from "@welshman/app"
import type {IApp} from "@welshman/app"
import {observeEventsById, synced, throttled} from "@welshman/store"
import {app} from "@app/core/app"
import {kv} from "@app/core/storage"
import {checked, isChecked, setChecked} from "@app/tools/checked"
import {
  getNotificationFacet,
  getNotificationFilters,
  getNotificationRef,
  groupNotifications,
  isNotification,
} from "@app/features/notifications/model"
import type {NotificationFacet, NotificationGroup} from "@app/features/notifications/model"
import {makeNoteResolver} from "@app/features/notes/resolver"
import type {NoteResolver} from "@app/features/notes/resolver"
import {isEventMuted} from "@app/tools/people/muting"

export const includedNotificationFacets = synced<NotificationFacet[]>({
  key: "includedHomeActivityTypes",
  defaultValue: ["spaces", "replies", "reactions", "zaps"],
  storage: kv,
})

// The stream is no route of its own, so what has been read sits under a path nothing navigates to.
const notificationsPath = "/home/notifications"

export const readNotifications = () => setChecked(notificationsPath)

const notificationCandidates = derived(
  app,
  ($app, set) => {
    const pubkey = $app.user?.pubkey

    if (pubkey) {
      return $app.use(Events).desc(getNotificationFilters(pubkey)).$.subscribe(set)
    }

    set([])
  },
  [] as TrustedEvent[],
)

let targetLoader: Maybe<{app: IApp; resolver: NoteResolver}>

// An app is scoped to one identity, so a login starts the bookkeeping over.
const getTargetResolver = ($app: IApp) => {
  if (targetLoader?.app === $app) {
    return targetLoader.resolver
  }

  targetLoader?.resolver.stop()

  const resolver = makeNoteResolver({batchSize: 100, maxAttempts: 2, timeout: 3000})

  targetLoader = {app: $app, resolver}

  return resolver
}

// A ref names its target by id or by address, so the map answers to either.
const indexTargets = (events: TrustedEvent[]) =>
  new Map(
    events.flatMap(event =>
      getIdAndAddress(event).map((key): [string, TrustedEvent] => [key, event]),
    ),
  )

const notificationTargets = derived(
  [app, throttled(ms(1), notificationCandidates)],
  ([$app, $candidates], set) => {
    const refs = uniqBy(
      ref => ref.getAddressOrId(),
      removeUndefined($candidates.map(getNotificationRef)),
    )

    if (refs.length > 0) {
      getTargetResolver($app).resolve(refs.map(ref => ({ref})))

      const keys = removeUndefined(refs.map(ref => ref.getAddressOrId()))

      return observeEventsById({
        repository: $app.repository,
        filters: getIdFilters(keys),
        onEvents: $byId => set(indexTargets([...$byId.values()])),
      })
    }

    set(new Map())
  },
  new Map<string, TrustedEvent>(),
)

export const notificationEvents = derived(
  [app, notificationCandidates, notificationTargets, isEventMuted],
  ([$app, $candidates, $targets, $isEventMuted]) =>
    $candidates.filter(event => {
      const key = getNotificationRef(event)?.getAddressOrId()

      if (key) {
        return isNotification(event, $targets.get(key), {
          pubkey: $app.user?.pubkey ?? "",
          isMuted: $isEventMuted,
        })
      }

      return false
    }),
)

const includedNotificationEvents = derived(
  [notificationEvents, includedNotificationFacets],
  ([$events, $facets]) =>
    $events.filter(event => {
      const facet = getNotificationFacet(event)

      return facet === "mentions" || $facets.includes(facet)
    }),
)

export const notificationsUnread = derived(
  [includedNotificationEvents, checked],
  ([$events, $checked]) =>
    $events.length > 0 && !isChecked($checked, notificationsPath, $events[0].created_at),
)

export type NotificationEntry = {group: NotificationGroup; note: TrustedEvent}

export const notificationEntries = derived(
  [includedNotificationEvents, notificationTargets],
  ([$events, $targets]) =>
    groupNotifications($events).flatMap(group => {
      const key = group.ref.getAddressOrId()
      const note = key ? $targets.get(key) : undefined

      return note ? [{group, note}] : []
    }),
)
