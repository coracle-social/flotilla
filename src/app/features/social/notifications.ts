import {derived} from "svelte/store"
import {
  ago,
  assoc,
  countBy,
  HOUR,
  int,
  max,
  noop,
  removeUndefined,
  sortBy,
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
  matchTag,
  tagSpec,
  tagValue,
  unionFilters,
  userInbox,
} from "@welshman/util"
import type {TrustedEvent} from "@welshman/util"
import {synced, throttled} from "@welshman/store"
import type {EventsById} from "@welshman/store"
import {Comment} from "@welshman/domain"
import {Events} from "@welshman/app"
import {app} from "@app/core/app"
import {reader} from "@app/core/domain"
import {network, router} from "@app/core/plugins"
import {ENABLE_ZAPS} from "@app/core/env"
import {kv} from "@app/core/storage"
import {makeKeyedSyncs, registerSync} from "@app/core/sync"
import {userRelayList} from "@app/core/user"
import {checked, setChecked} from "@app/features/checked"
import {getReplyRefs, isReplyKind} from "@app/features/social/replies"
import {Notes} from "@app/features/social/notes"
import {isEventMuted} from "@app/features/social/muting"

export const REPOST_KINDS = [REPOST, GENERIC_REPOST]

// One entry in the home notifications feed: a note, who answered it, and who reacted to it.
export type HomeNotification = {
  key: string
  ref: EventRef
  replies: TrustedEvent[]
  reactions: TrustedEvent[]
  timestamp: number
}

// What a notification is about: the note it answers or reacts to, or itself when it is a mention.
export const getNotificationRef = (event: TrustedEvent): Maybe<EventRef> => {
  if (isReplyKind(event)) {
    const {parent, root} = getReplyRefs(event)

    return parent ?? root ?? EventRef.fromEvent(event)
  }

  // NIP-25 asks a reaction to carry the tags of the event it is about, author included.
  const tag = matchTag(tagSpec("e"), event.tags)
  const pubkey = tagValue(tagSpec("p"), event.tags)

  return tag && new EventRef({id: tag[1], pubkey, relays: getRelayHints(tag)})
}

// An entry is a note and what was done to it, so nothing else can be the note one is drawn around.
export const isNotificationTarget = (event: TrustedEvent) =>
  event.kind === NOTE || (event.kind === COMMENT && reader(Comment)(event).root()?.kind === NOTE)

// Two entries in a row about one note read as a duplicate, whatever bucket split them.
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

// Everything done to one note collapses into a single entry rather than one per answer.
export const groupNotifications = (events: TrustedEvent[]) => {
  const interval = int(HOUR, 3)
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

export const homeNotificationFilters = (pubkey: string) => [
  {kinds: homeNotificationKinds, "#p": [pubkey]},
]

// What the tab can be narrowed to, with every type included until the reader says otherwise.
export const homeNotificationTypes = [
  {value: "replies", label: "Replies"},
  {value: "reactions", label: "Reactions"},
  {value: "zaps", label: "Zaps"},
] as const

export type HomeNotificationType = (typeof homeNotificationTypes)[number]["value"]

export const includedHomeNotificationTypes = synced<HomeNotificationType[]>({
  key: "includedHomeNotificationTypes",
  defaultValue: homeNotificationTypes.map(({value}) => value),
  storage: kv,
})

// A mention is the note itself rather than something done to it, so no toggle hides one.
const homeNotificationType = (event: TrustedEvent): Maybe<HomeNotificationType> => {
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

export const isIncludedHomeNotification = derived(
  includedHomeNotificationTypes,
  $included => (event: TrustedEvent) => {
    const type = homeNotificationType(event)

    return !type || $included.includes(type)
  },
)

export const getHomeNotificationRelays = () =>
  router
    .get()
    .resolve([userInbox()])
    .then(scenario => scenario.limit(10).getUrls())

// The home badge reads the repository, so these have to arrive whether or not home is open.
const syncHomeNotificationRelay = (url: string, pubkey: string) => {
  const controller = new AbortController()
  const filters = homeNotificationFilters(pubkey)

  network.get().load({
    relays: [url],
    signal: controller.signal,
    filters: filters.map(filter => ({...filter, limit: 100})),
  })

  network.get().request({
    relays: [url],
    signal: controller.signal,
    filters: unionFilters(filters.map(assoc("limit", 0))),
  })

  return () => controller.abort()
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

// The notifications tab is no route of its own, so what has been read sits under a path nothing navigates to.
const homeNotificationsPath = "/home/notifications"

export const readHomeNotifications = () => setChecked(homeNotificationsPath)

// Everything that could be an entry in the tab, newest first, whether or not one could be drawn.
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

// The note each entry is about, loaded here rather than per entry so the tab opens on what it has.
const homeNotificationTargets = derived(
  [app, throttled(1000, homeNotificationCandidates)],
  ([$app, $candidates], set: (targets: EventsById) => void) => {
    const refs = uniqBy(
      ref => ref.getAddressOrId(),
      removeUndefined($candidates.map(getNotificationRef)),
    )

    if (refs.length > 0) {
      for (const ref of refs) {
        $app.use(Notes).load(ref).catch(noop)
      }

      // A reference names its event by id or by address, so the event is found under both.
      return $app
        .use(Events)
        .byId(getIdFilters(removeUndefined(refs.map(ref => ref.getAddressOrId()))))
        .$.subscribe($byId =>
          set(
            new Map(
              Array.from($byId.values()).flatMap(event =>
                getIdAndAddress(event).map(key => [key, event] as const),
              ),
            ),
          ),
        )
    }

    set(new Map())
  },
  new Map() as EventsById,
)

// The badge and the tab count the same thing: somebody else's doing to a note an entry can be drawn around.
export const isHomeNotification = derived(
  [app, homeNotificationTargets, isEventMuted],
  ([$app, $targets, $isEventMuted]) => {
    // A zap receipt is signed by an lnurl server rather than by the zapper, so neither test reads it.
    const isFromSomeoneElse = (event: TrustedEvent) =>
      event.kind === ZAP_RECEIPT || (event.pubkey !== $app.user?.pubkey && !$isEventMuted(event))

    // An entry is drawn around its note, so a thread a muted person started is not one either.
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

// The badge reads the filters too, so nothing lights up over an entry the tab leaves out.
const latestHomeNotification = derived(
  [homeNotificationCandidates, isHomeNotification, isIncludedHomeNotification],
  ([$candidates, $isHomeNotification, $isIncluded]) =>
    $candidates.find(event => $isHomeNotification(event) && $isIncluded(event)),
)

export const homeNotificationsUnread = derived(
  [latestHomeNotification, checked],
  ([$latest, $checked]) =>
    Boolean($latest && $latest.created_at > ($checked[homeNotificationsPath] ?? 0)),
)

export const registerHomeNotifications = () => {
  registerSync(syncHomeNotifications)
}
