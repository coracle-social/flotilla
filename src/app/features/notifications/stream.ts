import {derived} from "svelte/store"
import {ms, removeUndefined, uniqBy} from "@welshman/lib"
import type {Maybe} from "@welshman/lib"
import {getIdAndAddress, getIdFilters} from "@welshman/util"
import type {Filter, TrustedEvent} from "@welshman/util"
import {Events} from "@welshman/app"
import type {IApp} from "@welshman/app"
import {observeEventsById, synced, throttled} from "@welshman/store"
import {app} from "@app/core/app"
import {kv} from "@app/core/storage"
import {checked, setChecked} from "@app/features/checked"
import {
  NOTIFICATION_KINDS,
  getNotificationFacet,
  getNotificationRef,
  groupNotifications,
  isNotification,
} from "@app/features/notifications/model"
import type {NotificationFacet, NotificationGroup} from "@app/features/notifications/model"
import {makeNoteResolver} from "@app/features/social/noteResolver"
import type {NoteResolver} from "@app/features/social/noteResolver"
import {isEventMuted} from "@app/features/social/muting"

export const includedNotificationFacets = synced<NotificationFacet[]>({
  key: "includedHomeActivityTypes",
  defaultValue: ["spaces", "replies", "reactions", "zaps"],
  storage: kv,
})

// The stream is no route of its own, so what has been read sits under a path nothing navigates to.
const notificationsPath = "/home/notifications"

export const readNotifications = () => setChecked(notificationsPath)

const filtersFor = (pubkey: string): Filter[] => [{kinds: NOTIFICATION_KINDS, "#p": [pubkey]}]

const notificationCandidates = derived(
  app,
  ($app, set) => {
    const pubkey = $app.user?.pubkey

    if (pubkey) {
      return $app.use(Events).desc(filtersFor(pubkey)).$.subscribe(set)
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
        onEvents: $byId => {
          const targets = new Map<string, TrustedEvent>()

          // A ref names its target by id or by address, so the map answers to either.
          for (const event of $byId.values()) {
            for (const key of getIdAndAddress(event)) {
              targets.set(key, event)
            }
          }

          set(targets)
        },
      })
    }

    set(new Map())
  },
  new Map<string, TrustedEvent>(),
)

const isNotificationEvent = derived(
  [app, notificationTargets, isEventMuted],
  ([$app, $targets, $isEventMuted]) =>
    (event: TrustedEvent) => {
      const key = getNotificationRef(event)?.getAddressOrId()

      if (key) {
        return isNotification(event, $targets.get(key), {
          pubkey: $app.user?.pubkey ?? "",
          isMuted: $isEventMuted,
        })
      }

      return false
    },
)

export const notificationEvents = derived(
  [notificationCandidates, isNotificationEvent],
  ([$candidates, $isNotificationEvent]) => $candidates.filter($isNotificationEvent),
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
  ([$events, $checked]) => ($events[0]?.created_at ?? 0) > ($checked[notificationsPath] ?? 0),
)

export type NotificationEntry = {group: NotificationGroup; note: TrustedEvent}

export const notificationEntries = derived(
  [includedNotificationEvents, notificationTargets],
  ([$events, $targets]) => {
    const entries: NotificationEntry[] = []

    for (const group of groupNotifications($events)) {
      const key = group.ref.getAddressOrId()
      const note = key ? $targets.get(key) : undefined

      if (note) {
        entries.push({group, note})
      }
    }

    return entries
  },
)
