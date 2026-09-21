import {derived, get, writable} from "svelte/store"
import {Badge} from "@capawesome/capacitor-badge"
import {page} from "$app/stores"
import {assoc, first, identity, groupBy, now, remove, throttle, parseJson, gt} from "@welshman/lib"
import type {SignedEvent, TrustedEvent} from "@welshman/util"
import {
  getIdOrAddress,
  sortEventsDesc,
  tagSpec,
  tagValue,
  COMMENT,
  MESSAGE,
  makeHttpAuth,
  makeHttpAuthHeader,
} from "@welshman/util"
import {synced, throttled, withGetter} from "@welshman/store"
import {Relays, RoomLists} from "@welshman/app"
import {deriveEventsByIdByUrl} from "@app/repository"
import {app, fromApp} from "@app/core"
import {makeRoomPath, makeSpaceChatPath, makeChatPath, makeContentPath} from "@app/routes"
import {CONTENT_KINDS, makeCommentFilter} from "@app/content"
import {getIsMuted, notificationSettings, userSettingsValues} from "@app/settings"
import {chatsById} from "@app/chats"
import {dufflepud, DUFFLEPUD_URL, PLATFORM_RELAYS} from "@app/env"
import {kv} from "@app/storage"

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
      const defer = get(deferredRoomPath)

      checked.update($checked => {
        for (const path of paths) {
          if (defer && path === defer) {
            continue
          }
          $checked[path] = now()
        }

        return $checked
      })
    }, 300)

    prev = paths
  })
}

const CHECKED_KV_KEY = "checked"
const NIP98_MAX_AGE = 23 * 60 * 60

let nip98Auth: SignedEvent | undefined

const nip98Header = async () => {
  const $signer = app.get().user?.signer

  if (!$signer) {
    return undefined
  }

  if (!nip98Auth || now() - nip98Auth.created_at > NIP98_MAX_AGE) {
    nip98Auth = await $signer.sign(await makeHttpAuth(DUFFLEPUD_URL, "GET"))
  }

  return makeHttpAuthHeader(nip98Auth)
}

const pullCheckedRemote = async () => {
  const authorization = await nip98Header()

  if (!authorization) {
    return
  }

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
  const authorization = await nip98Header()

  if (!authorization) {
    return
  }

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
    nip98Auth = undefined

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

// The content item an event belongs to - either the content event itself, or the root of a comment
const getContentTarget = (event: TrustedEvent) => {
  if (CONTENT_KINDS.includes(event.kind)) {
    return {kind: event.kind, idOrAddress: getIdOrAddress(event)}
  }

  if (event.kind === COMMENT) {
    const kind = parseInt(tagValue(tagSpec("K"), event.tags) || "")
    const idOrAddress = tagValue(tagSpec("A"), event.tags) || tagValue(tagSpec("E"), event.tags)

    if (CONTENT_KINDS.includes(kind) && idOrAddress) {
      return {kind, idOrAddress}
    }
  }
}

// Where an activity happened, alongside the event itself. The map is built from room lists, chats
// and content targets, all of which know what they are - a consumer handed only a path would have
// to parse it back apart. `contentKind` is what an activity is filed under when it belongs to a
// content item rather than to a conversation, and a comment files under its subject's kind.
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
        app,
        chatsById,
        fromApp($app => $app.use(Relays).index.$),
        fromApp($app => $app.use(RoomLists).index.$),
        deriveEventsByIdByUrl([
          {kinds: [MESSAGE, ...CONTENT_KINDS]},
          makeCommentFilter(CONTENT_KINDS),
        ]),
        userSettingsValues,
      ],
      identity,
    ),
  ),
  ([$app, $chatsById, $relays, $roomLists, eventsByIdByUrl, $settings]) => {
    const activity = new Map<string, Activity>()

    for (const {pubkeys, messages} of $chatsById.values()) {
      const path = makeChatPath(pubkeys)

      activity.set(path, {path, pubkeys, event: messages[0]})
    }

    const roomList = $app.user?.pubkey ? $roomLists.get($app.user.pubkey) : undefined
    const urls = PLATFORM_RELAYS.length > 0 ? PLATFORM_RELAYS : (roomList?.urls() ?? [])

    for (const url of urls) {
      const events = sortEventsDesc((eventsByIdByUrl.get(url) || new Map()).values())

      if ($relays.get(url)?.hasNip(29)) {
        for (const [h, [event]] of groupBy(e => tagValue(tagSpec("h"), e.tags), events)) {
          // A muted room is left out entirely, so it can't light up its own badge or the space's
          if (h && !getIsMuted($settings, url, h)) {
            const path = makeRoomPath(url, h)

            activity.set(path, {path, url, h, event})
          }
        }
      } else {
        const event = first(events)

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
      [...$allNotifications].filter(p => {
        if (!$page.url.pathname.startsWith(p)) {
          return true
        }
        if ($deferredRoomPath && p === $deferredRoomPath) {
          return true
        }
        return false
      }),
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
