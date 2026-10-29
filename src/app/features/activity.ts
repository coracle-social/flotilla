import {derived} from "svelte/store"
import {
  ago,
  countBy,
  first,
  formatTimestampAsTime,
  HOUR,
  int,
  LOCALE,
  max,
  MINUTE,
  MONTH,
  ms,
  noop,
  now,
  removeUndefined,
  secondsToDate,
  sortBy,
  uniq,
  uniqBy,
} from "@welshman/lib"
import type {Maybe} from "@welshman/lib"
import {
  COMMENT,
  EventRef,
  GENERIC_REPOST,
  NOTE,
  REACTION,
  REPOST,
  ZAP_RECEIPT,
  getIdAndAddress,
  getIdFilters,
  getRelayHints,
  hexTags,
  matchTag,
  tagSpec,
  tagValue,
  tagValues,
  userInbox,
} from "@welshman/util"
import type {TrustedEvent} from "@welshman/util"
import {observeEventsById, synced, throttled} from "@welshman/store"
import type {EventsById} from "@welshman/store"
import {Comment} from "@welshman/domain"
import {Events, Network} from "@welshman/app"
import type {IApp} from "@welshman/app"
import {app} from "@app/core/app"
import {reader} from "@app/core/domain"
import {network, router} from "@app/core/plugins"
import {ENABLE_ZAPS} from "@app/core/env"
import {registerRetention} from "@app/core/database"
import {kv} from "@app/core/storage"
import {makeKeyedSyncs, registerSync} from "@app/core/sync"
import {userRelayList} from "@app/core/user"
import {checked, setChecked} from "@app/features/checked"
import {allNotifications, latestActivityByPath} from "@app/features/notifications"
import type {Activity} from "@app/features/notifications"
import {getReplyRefs, isReplyKind} from "@app/features/social/replies"
import {Notes} from "@app/features/social/notes"
import {isEventMuted} from "@app/features/social/muting"

// Every conversation, read or not, so the stream reads as history rather than as a queue to drain.
export const recentConversations = derived(latestActivityByPath, $latestActivityByPath =>
  sortBy(
    activity => -activity.event.created_at,
    [...$latestActivityByPath.values()].filter(activity => !activity.contentKind),
  ),
)

const shortDate = (ts: number) =>
  Intl.DateTimeFormat(LOCALE, {dateStyle: "short"}).format(secondsToDate(ts))

export const displayActivityTimestamp = (ts: number) =>
  shortDate(ts) === shortDate(now()) ? formatTimestampAsTime(ts) : shortDate(ts)

export type SpaceContent = {
  url: string
  timestamp: number
  countsByKind: Map<number, number>
}

// Counted only where unread, since a total would be the same number every day.
export const unreadSpaceContent = derived(
  [latestActivityByPath, allNotifications],
  ([$latestActivityByPath, $allNotifications]) => {
    const byUrl = new Map<string, SpaceContent>()

    for (const {path, url, contentKind, event} of $latestActivityByPath.values()) {
      if (url && contentKind && $allNotifications.has(path)) {
        const content = byUrl.get(url) ?? {url, timestamp: 0, countsByKind: new Map()}

        content.timestamp = Math.max(content.timestamp, event.created_at)
        content.countsByKind.set(contentKind, (content.countsByKind.get(contentKind) ?? 0) + 1)
        byUrl.set(url, content)
      }
    }

    return sortBy(content => -content.timestamp, [...byUrl.values()])
  },
)

// Activity in a space names the relay it happened on; a direct message names none.
export const isSpaceActivity = (activity: Activity) => Boolean(activity.url)

// What the stream can be narrowed to, with every type included until the reader says otherwise.
export type HomeActivityType = "spaces" | "replies" | "reactions" | "zaps"

export const includedHomeActivityTypes = synced<HomeActivityType[]>({
  key: "includedHomeActivityTypes",
  defaultValue: ["spaces", "replies", "reactions", "zaps"],
  storage: kv,
})

export const REPOST_KINDS = [REPOST, GENERIC_REPOST]

// One notification in the home stream: a note, who answered it, and who reacted to it.
export type HomeNotification = {
  key: string
  ref: EventRef
  replies: TrustedEvent[]
  reactions: TrustedEvent[]
  timestamp: number
}

// What a notification is about: the note it answers or reacts to, or itself when it is a mention.
const getNotificationRef = (event: TrustedEvent): Maybe<EventRef> => {
  if (isReplyKind(event)) {
    const {parent, root} = getReplyRefs(event)

    return parent ?? root ?? EventRef.fromEvent(event)
  }

  // NIP-25 asks a reaction to carry the tags of the event it is about, author included.
  const tag = matchTag(tagSpec("e"), event.tags)
  const pubkey = tagValue(tagSpec("p"), event.tags)

  return tag && new EventRef({id: tag[1], pubkey, relays: getRelayHints(tag)})
}

// A notification is a note and what was done to it, so nothing else can be the note one is drawn around.
const isNotificationTarget = (event: TrustedEvent) =>
  event.kind === NOTE || (event.kind === COMMENT && reader(Comment)(event).root()?.kind === NOTE)

// Two notifications in a row about one note read as a duplicate, whatever bucket split them.
const mergeAdjacent = (notifications: HomeNotification[]) => {
  const merged: HomeNotification[] = []

  for (const notification of notifications) {
    const previous = merged[merged.length - 1]

    if (previous?.ref.getAddressOrId() === notification.ref.getAddressOrId()) {
      merged[merged.length - 1] = {
        ...previous,
        ref: EventRef.merge(previous.ref, notification.ref),
        replies: [...previous.replies, ...notification.replies],
        reactions: [...previous.reactions, ...notification.reactions],
      }
    } else {
      merged.push(notification)
    }
  }

  return merged
}

// Everything done to one note collapses into a single notification rather than one per answer.
export const groupNotifications = (events: TrustedEvent[]) => {
  const interval = int(3, HOUR)
  const notifications = new Map<string, HomeNotification>()

  for (const event of events) {
    const ref = getNotificationRef(event)
    const target = ref?.getAddressOrId()

    if (ref && target) {
      // The window is measured back from now, so two answers minutes apart never straddle an edge.
      const key = `${target}:${Math.round(ago(event.created_at) / interval)}`
      const notification = notifications.get(key) ?? {
        key,
        ref,
        replies: [],
        reactions: [],
        timestamp: 0,
      }

      if (ref.id !== event.id) {
        const answers = isReplyKind(event) ? notification.replies : notification.reactions

        answers.push(event)
      }

      notifications.set(key, {
        ...notification,
        ref: EventRef.merge(notification.ref, ref),
        timestamp: max([notification.timestamp, event.created_at]),
      })
    }
  }

  return mergeAdjacent(
    sortBy(notification => -notification.timestamp, Array.from(notifications.values())),
  )
}

// A report and a delete travel the same way and are nobody's good news, so this is not `REACTION_KINDS`.
const homeNotificationKinds = [NOTE, COMMENT, REACTION, ...REPOST_KINDS]

if (ENABLE_ZAPS) {
  homeNotificationKinds.push(ZAP_RECEIPT)
}

const homeNotificationFilters = (pubkey: string) => [{kinds: homeNotificationKinds, "#p": [pubkey]}]

// A mention is the note itself rather than something done to it, so no toggle hides one.
const homeNotificationType = (event: TrustedEvent): Maybe<HomeActivityType> => {
  if (event.kind === ZAP_RECEIPT) {
    return "zaps"
  } else if (event.kind === REACTION || REPOST_KINDS.includes(event.kind)) {
    return "reactions"
  } else if (getNotificationRef(event)?.id !== event.id) {
    return "replies"
  }
}

export const countHomeNotificationTypes = (events: TrustedEvent[]) =>
  countBy(homeNotificationType, events)

const getHomeNotificationRelays = () =>
  router
    .get()
    .resolve([userInbox()])
    .then(scenario => scenario.limit(10).getUrls())

// The badge and the stream both read the repository, so this runs whether or not home is open.
const syncHomeNotificationRelay = (url: string, pubkey: string) => {
  const controller = new AbortController()
  const filters = homeNotificationFilters(pubkey)

  // Only the first poll pays for a page; the rest ask for the stretch since the one before.
  let since: Maybe<number>

  const poll = async () => {
    const asked = now()
    const extension = since ? {since} : {limit: 100}

    await network.get().load({
      relays: [url],
      signal: controller.signal,
      // The first poll is what the stream opens on; a refresh goes under the default, so nothing on screen waits behind it.
      priority: since ? -1 : 0,
      filters: filters.map(filter => ({...filter, ...extension})),
    })

    // A minute of overlap, since the relay stamps an event by its own clock rather than ours.
    since = asked - int(MINUTE)
  }

  poll()

  const interval = setInterval(poll, ms(int(2, MINUTE)))

  return () => {
    clearInterval(interval)
    controller.abort()
  }
}

const syncHomeNotifications = () => {
  const $pubkey = app.get().user?.pubkey

  if ($pubkey) {
    const relaySyncs = makeKeyedSyncs(url => syncHomeNotificationRelay(url, $pubkey))

    let stopped = false

    const reconcile = async () => {
      const urls = await getHomeNotificationRelays()

      if (!stopped) {
        relaySyncs.reconcile(urls)
      }
    }

    const unsubscribeRelayList = userRelayList.subscribe(reconcile)

    return () => {
      stopped = true
      relaySyncs.stop()
      unsubscribeRelayList()
    }
  }

  return noop
}

// The stream is no route of its own, so what has been read sits under a path nothing navigates to.
const homeNotificationsPath = "/home/notifications"

export const readHomeNotifications = () => setChecked(homeNotificationsPath)

// Everything that could be a notification in the stream, newest first, whether or not one could be drawn.
const homeNotificationCandidates = derived(
  app,
  ($app, set: (events: TrustedEvent[]) => void) => {
    const pubkey = $app.user?.pubkey

    if (pubkey) {
      return $app.use(Events).desc(homeNotificationFilters(pubkey)).$.subscribe(set)
    }

    set([])
  },
  [] as TrustedEvent[],
)

// Notes being looked for, so candidates landing meanwhile don't ask for them again.
const loadingTargets = new Set<string>()

// Every note the stream is missing goes out in one request rather than one per note.
const loadHomeNotificationTargets = async ($app: IApp, refs: EventRef[]) => {
  const pending = refs.flatMap(ref => {
    const key = ref.getAddressOrId()

    return key && !loadingTargets.has(key) ? [{ref, key}] : []
  })

  const keys = pending.map(({key}) => key)

  keys.forEach(key => loadingTargets.add(key))

  try {
    const stored = await $app.repository.query(getIdFilters(keys))
    const storedKeys = new Set(stored.flatMap(getIdAndAddress))
    const missing = pending.filter(({key}) => !storedKeys.has(key))

    if (missing.length > 0) {
      const relaysByRef = await Promise.all(missing.map(({ref}) => $app.use(Notes).relays(ref)))

      await $app.use(Network).load({
        relays: uniq(relaysByRef.flat()),
        filters: getIdFilters(missing.map(({key}) => key)),
        timeout: 3000,
      })
    }
  } finally {
    keys.forEach(key => loadingTargets.delete(key))
  }
}

// Each notification's note, loaded here rather than per notification so the stream opens on what it has.
const homeNotificationTargets = derived(
  [app, throttled(1000, homeNotificationCandidates)],
  ([$app, $candidates], set: (targets: EventsById) => void) => {
    const refs = uniqBy(
      ref => ref.getAddressOrId(),
      removeUndefined($candidates.map(getNotificationRef)),
    )

    if (refs.length > 0) {
      loadHomeNotificationTargets($app, refs).catch(noop)

      // A reference names its event by id or by address, so the event is found under both.
      return observeEventsById({
        repository: $app.repository,
        filters: getIdFilters(removeUndefined(refs.map(ref => ref.getAddressOrId()))),
        onEvents: $byId =>
          set(
            new Map(
              Array.from($byId.values()).flatMap(event =>
                getIdAndAddress(event).map(key => [key, event] as const),
              ),
            ),
          ),
      })
    }

    set(new Map())
  },
  new Map() as EventsById,
)

// The badge and the stream count the same thing: somebody else's doing to a note a notification can be drawn around.
const isHomeNotification = derived(
  [app, homeNotificationTargets, isEventMuted],
  ([$app, $targets, $isEventMuted]) => {
    // A zap receipt is signed by an lnurl server rather than by the zapper, so neither test reads it.
    const isFromSomeoneElse = (event: TrustedEvent) =>
      event.kind === ZAP_RECEIPT || (event.pubkey !== $app.user?.pubkey && !$isEventMuted(event))

    // A notification is drawn around its note, so a thread a muted person started is not one either.
    return (event: TrustedEvent) => {
      const key = getNotificationRef(event)?.getAddressOrId()
      const target = key && $targets.get(key)

      return Boolean(
        target &&
        isNotificationTarget(target) &&
        !$isEventMuted(target) &&
        isFromSomeoneElse(event),
      )
    }
  },
)

// Every event the stream can draw a notification around, newest first, before the type filters narrow it.
export const homeNotificationEvents = derived(
  [homeNotificationCandidates, isHomeNotification],
  ([$candidates, $isHomeNotification]) => $candidates.filter($isHomeNotification),
)

// The badge reads these too, so nothing lights up over a notification the stream leaves out.
export const includedHomeNotificationEvents = derived(
  [homeNotificationEvents, includedHomeActivityTypes],
  ([$events, $included]) =>
    $events.filter(event => {
      const type = homeNotificationType(event)

      return !type || $included.includes(type)
    }),
)

export const homeNotificationsUnread = derived(
  [includedHomeNotificationEvents, checked],
  ([$events, $checked]) => {
    const latest = first($events)

    return Boolean(latest && latest.created_at > ($checked[homeNotificationsPath] ?? 0))
  },
)

export const registerActivity = () => {
  registerSync(syncHomeNotifications)

  // The stream draws on what was done to your notes and on the notes themselves, so neither waits on a relay at startup.
  registerRetention({
    match: (event, pubkey) =>
      (homeNotificationKinds.includes(event.kind) &&
        tagValues(hexTags("p"), event.tags).includes(pubkey)) ||
      (event.pubkey === pubkey && isNotificationTarget(event)),
    maxAge: int(1, MONTH),
  })
}
