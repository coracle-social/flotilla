import {derived, get, writable} from "svelte/store"
import {Badge} from "@capawesome/capacitor-badge"
import {page} from "$app/stores"
import {
  assoc,
  first,
  identity,
  groupBy,
  noop,
  now,
  remove,
  removeUndefined,
  sortBy,
  throttle,
  parseJson,
  spec,
  gt,
  int,
  uniqBy,
  HOUR,
} from "@welshman/lib"
import type {TrustedEvent} from "@welshman/util"
import {
  COMMENT,
  MESSAGE,
  NOTE,
  REACTION,
  ZAP_RECEIPT,
  addMinimalFallbacks,
  getIdFilters,
  sortEventsDesc,
  tagSpec,
  tagValue,
  userInbox,
} from "@welshman/util"
import {synced, throttled, withGetter} from "@welshman/store"
import type {EventsById} from "@welshman/store"
import {Events, Relays} from "@welshman/app"
import {app, fromApp, network, router} from "@app/core"
import {makeRoomPath, makeSpaceChatPath, makeChatPath, makeContentPath} from "@app/routes"
import {CONTENT_KINDS, REPOST_KINDS, getActivityTarget, makeCommentFilter} from "@app/content"
import {getIsMuted, userSettingsValues} from "@app/settings"
import {Chats} from "@app/chats"
import {dufflepud, DUFFLEPUD_URL, ENABLE_ZAPS} from "@app/env"
import {spaceSupportsRooms} from "@app/relays"
import {activeSpaceUrls} from "@app/rooms"
import {getNotificationRef, isNotificationTarget, Notes} from "@app/social"
import {getHttpAuthHeader} from "@app/signer"
import {kv} from "@app/storage"
import {notificationSettings} from "@app/push/adapters/common"

// Checked state

export const checked = withGetter(
  synced<Record<string, number>>({
    key: "checked",
    defaultValue: {},
    storage: kv,
  }),
)

export const getChecked = (key: string) => checked.get()[key]

export const setChecked = (key: string) => checked.update(assoc(key, now()))

/** Room path while video call UI hides chat; checked + badge stay active until chat is shown. */
export const deferredRoomPath = writable<string | undefined>(undefined)

const getPaths = (path: string) =>
  path
    .split("/")
    .map((_, i, segments) => segments.slice(0, i + 1).join("/"))
    .slice(1)

export const syncChecked = () => {
  let prev: string[] = []

  return page.subscribe($page => {
    // Set checked when we leave a given page
    checked.update($checked => {
      for (const path of prev) {
        $checked[path] = now()
      }

      return $checked
    })

    const paths = getPaths($page.url.pathname)

    // Set checked when we visit a given page - but delay it a tad
    setTimeout(() => {
      const $deferredRoomPath = get(deferredRoomPath)

      checked.update($checked => {
        for (const path of paths) {
          if (path !== $deferredRoomPath) {
            $checked[path] = now()
          }
        }

        return $checked
      })
    }, 300)

    prev = paths
  })
}

const CHECKED_KV_KEY = "checked"
const getAuthHeader = () => getHttpAuthHeader(DUFFLEPUD_URL, int(23, HOUR))

const pullCheckedRemote = async () => {
  const authorization = await getAuthHeader()
  const res = await fetch(dufflepud(`kv/${CHECKED_KV_KEY}`), {headers: {authorization}})

  if (!res.ok) {
    return
  }

  const remote = parseJson<Record<string, number>>(await res.text())

  if (!remote) {
    return
  }

  checked.update($checked => {
    for (const [path, ts] of Object.entries(remote)) {
      if (gt(ts, $checked[path])) {
        $checked[path] = ts
      }
    }

    return $checked
  })
}

const pushCheckedRemote = throttle(3000, async () => {
  const authorization = await getAuthHeader()

  try {
    await fetch(dufflepud(`kv/${CHECKED_KV_KEY}`), {
      method: "POST",
      headers: {authorization},
      body: JSON.stringify(checked.get()),
    })
  } catch {
    // pass
  }
})

export const syncCheckedRemote = () => {
  let ready = false

  const unsubscribeUser = app.subscribe($app => {
    ready = false

    if ($app.user) {
      pullCheckedRemote().then(() => {
        ready = true
        pushCheckedRemote()
      })
    }
  })

  const unsubscribeChecked = checked.subscribe(() => {
    if (ready && app.get().user?.pubkey) {
      pushCheckedRemote()
    }
  })

  return () => {
    unsubscribeUser()
    unsubscribeChecked()
  }
}

// Derived notifications state

// The content item an event belongs to, when it belongs to one at all.
const getContentTarget = (event: TrustedEvent) => {
  const target = getActivityTarget(event)

  if (CONTENT_KINDS.includes(target.kind)) {
    return target
  }
}

// Where an activity happened. `contentKind` files one under a content item rather than a conversation.
export type Activity = {
  path: string
  event: TrustedEvent
  contentKind?: number
  url?: string
  h?: string
  pubkeys?: string[]
}

// Assumes `events` is sorted descending, so the first event seen per content item wins.
const latestContentActivity = (url: string, events: TrustedEvent[]) => {
  const byPath = new Map<string, Activity>()

  for (const event of events) {
    const target = getContentTarget(event)

    if (!target) {
      continue
    }

    const path = makeContentPath(url, target.kind, target.idOrAddress)

    if (path && !byPath.has(path)) {
      byPath.set(path, {path, url, contentKind: target.kind, event})
    }
  }

  return byPath
}

export const latestActivityByPath = derived(
  throttled(
    1000,
    derived(
      [
        activeSpaceUrls,
        fromApp($app => $app.use(Chats).index.$),
        // Only here to recompute once a relay's NIP-11 says whether the space supports rooms
        fromApp($app => $app.use(Relays).index.$),
        fromApp(
          $app =>
            $app
              .use(Events)
              .byIdByUrl([{kinds: [MESSAGE, ...CONTENT_KINDS]}, makeCommentFilter(CONTENT_KINDS)])
              .$,
        ),
        userSettingsValues,
      ],
      identity,
    ),
  ),
  ([$activeSpaceUrls, $chatsById, , eventsByIdByUrl, $settings]) => {
    const activity = new Map<string, Activity>()

    for (const {pubkeys, messages} of $chatsById.values()) {
      const path = makeChatPath(pubkeys)

      activity.set(path, {path, pubkeys, event: messages[0]})
    }

    for (const url of $activeSpaceUrls) {
      const events = sortEventsDesc((eventsByIdByUrl.get(url) || new Map()).values())
      // A chat is its own messages; content and its comments carry the room h but belong to the item.
      const messages = events.filter(spec({kind: MESSAGE}))

      if (spaceSupportsRooms(url)) {
        for (const [h, [event]] of groupBy(e => tagValue(tagSpec("h"), e.tags), messages)) {
          // A muted room is left out entirely, so it can't light up its own badge or the space's
          if (h && !getIsMuted($settings, url, h)) {
            const path = makeRoomPath(url, h)

            activity.set(path, {path, url, h, event})
          }
        }
      } else {
        const event = first(messages)

        if (event) {
          const path = makeSpaceChatPath(url)

          activity.set(path, {path, url, event})
        }
      }

      for (const [path, contentActivity] of latestContentActivity(url, events)) {
        activity.set(path, contentActivity)
      }
    }

    return activity
  },
)

export const allNotifications = derived(
  [app, latestActivityByPath, checked],
  ([$app, $latestActivityByPath, $checked]) => {
    const hasNotification = (path: string, latestEvent: TrustedEvent) => {
      if (latestEvent.pubkey === $app.user?.pubkey) {
        return false
      }

      for (const [entryPath, ts] of Object.entries($checked)) {
        const isMatch = entryPath.endsWith("*")
          ? path.startsWith(entryPath.slice(0, -1))
          : entryPath.startsWith(path)

        if (isMatch && ts > latestEvent.created_at) {
          return false
        }
      }

      return true
    }

    const paths = new Set<string>()

    for (const [path, {event}] of $latestActivityByPath) {
      if (hasNotification(path, event)) {
        paths.add(path)

        for (const branchPath of remove(path, getPaths(path.split("?")[0]))) {
          if (hasNotification(branchPath, event)) {
            paths.add(branchPath)
          }
        }
      }
    }

    return paths
  },
)

export const notifications = derived(
  [page, allNotifications, deferredRoomPath],
  ([$page, $allNotifications, $deferredRoomPath]) =>
    new Set(
      [...$allNotifications].filter(
        p => !$page.url.pathname.startsWith(p) || p === $deferredRoomPath,
      ),
    ),
)

const countActivity = (activity: Map<string, Activity>, paths: Set<string>) =>
  [...activity.keys()].filter(path => paths.has(path)).length

export const notificationCount = derived(
  [latestActivityByPath, notifications],
  ([$latestActivityByPath, $notifications]) => countActivity($latestActivityByPath, $notifications),
)

export const backgroundNotificationCount = derived(
  [latestActivityByPath, allNotifications],
  ([$latestActivityByPath, $allNotifications]) =>
    countActivity($latestActivityByPath, $allNotifications),
)

// Badges

export const syncBadges = () =>
  derived([notificationCount, notificationSettings], identity).subscribe(
    async ([count, $notificationSettings]) => {
      if ($notificationSettings.badge) {
        try {
          await Badge.set({count})
        } catch (err) {
          // pass - firefox doesn't support badges
        }
      } else {
        await clearBadges()
      }
    },
  )

export const clearBadges = async () => {
  try {
    await Badge.clear()
  } catch (e) {
    // pass - firefox doesn't support this
  }
}

// Inbox

// The inbox shows what the badges show, so reading a conversation takes it out of the list.
export const inboxConversations = derived(
  [latestActivityByPath, allNotifications],
  ([$latestActivityByPath, $allNotifications]) =>
    sortBy(
      activity => -activity.event.created_at,
      [...$latestActivityByPath.values()].filter(
        activity => !activity.contentKind && $allNotifications.has(activity.path),
      ),
    ),
)

export type SpaceContent = {
  url: string
  timestamp: number
  countsByKind: Map<number, number>
}

// Counted only where unread, since a total would be the same number every day.
export const inboxSpaceContent = derived(
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

// Home notifications

// A report and a delete travel the same way and are nobody's good news, so this is not `REACTION_KINDS`.
const homeNotificationKinds = [
  NOTE,
  COMMENT,
  REACTION,
  ...REPOST_KINDS,
  ...(ENABLE_ZAPS ? [ZAP_RECEIPT] : []),
]

export const homeNotificationFilters = (pubkey: string) => [
  {kinds: homeNotificationKinds, "#p": [pubkey]},
]

// Answering or reacting to the user delivers the event to the relays the user reads from.
export const getHomeNotificationRelays = () =>
  router
    .get()
    .resolve([userInbox()])
    .then(scenario => scenario.policy(addMinimalFallbacks).getUrls())

// Nothing else asks for these, and the newest of them may be about something the tab cannot draw.
export const loadHomeNotifications = async (pubkey: string) =>
  network.get().loadLenient({
    relays: await getHomeNotificationRelays(),
    filters: homeNotificationFilters(pubkey).map(filter => ({...filter, limit: 20})),
  })

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
    const refs = uniqBy(ref => ref.id, removeUndefined($candidates.map(getNotificationRef)))

    if (refs.length > 0) {
      for (const {id, author, relays} of refs) {
        $app.use(Notes).load({id, author, relays}).catch(noop)
      }

      return $app
        .use(Events)
        .byId(getIdFilters(refs.map(ref => ref.id)))
        .$.subscribe(set)
    }

    set(new Map())
  },
  new Map() as EventsById,
)

// A notification nobody could draw an entry for counts for nothing, badge and tab alike.
export const isHomeNotification = derived(
  homeNotificationTargets,
  $targets => (event: TrustedEvent) => {
    const ref = getNotificationRef(event)
    const target = ref && $targets.get(ref.id)

    return Boolean(target && isNotificationTarget(target))
  },
)

// A reply of the user's own tags them along with everyone else in the thread.
const latestHomeNotification = derived(
  [app, homeNotificationCandidates, isHomeNotification],
  ([$app, $candidates, $isHomeNotification]) =>
    $candidates.find(event => event.pubkey !== $app.user?.pubkey && $isHomeNotification(event)),
)

export const homeNotificationsUnread = derived(
  [latestHomeNotification, checked],
  ([$latest, $checked]) =>
    Boolean($latest && $latest.created_at > ($checked[homeNotificationsPath] ?? 0)),
)
