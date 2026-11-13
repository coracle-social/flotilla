import {derived} from "svelte/store"
import {page} from "$app/stores"
import {
  first,
  formatTimestampAsTime,
  groupBy,
  identity,
  LOCALE,
  now,
  remove,
  secondsToDate,
  sortBy,
  spec,
} from "@welshman/lib"
import type {TrustedEvent} from "@welshman/util"
import {MESSAGE, sortEventsDesc, tagSpec, tagValue} from "@welshman/util"
import {throttled} from "@welshman/store"
import {Events, Relays} from "@welshman/app"
import {makeCommentFilter} from "@lib/util"
import {app, fromApp} from "@app/core/app"
import {relays} from "@app/core/plugins"
import {getIsMuted, userSettingsValues} from "@app/core/settings"
import * as pages from "@app/navigation/pages"
import {getActivityTarget} from "@app/navigation/locations"
import {activeSpaceUrls, CONTENT_KINDS} from "@app/features/spaces"
import {Messages} from "@app/features/messages"
import {checked, deferredRoomPath, getPaths} from "@app/features/checked"

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

    const path = pages.makeContentPath(url, target.kind, target.idOrAddress)

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
        fromApp($app => $app.use(Messages).index.$),
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
  ([$activeSpaceUrls, $conversationsById, , eventsByIdByUrl, $settings]) => {
    const activity = new Map<string, Activity>()

    for (const {pubkeys, messages} of $conversationsById.values()) {
      const path = pages.conversation.path({pubkeys})

      activity.set(path, {path, pubkeys, event: messages[0]})
    }

    for (const url of $activeSpaceUrls) {
      const events = sortEventsDesc((eventsByIdByUrl.get(url) || new Map()).values())
      // A conversation is its own messages; content and its comments carry the room h but belong to the item.
      const messages = events.filter(spec({kind: MESSAGE}))

      if (relays.get().get(url)?.hasNip(29)) {
        for (const [h, [event]] of groupBy(e => tagValue(tagSpec("h"), e.tags), messages)) {
          // A muted room is left out entirely, so it can't light up its own badge or the space's
          if (h && !getIsMuted($settings, url, h)) {
            const path = pages.room.path({url, h})

            activity.set(path, {path, url, h, event})
          }
        }
      } else {
        const event = first(messages)

        if (event) {
          const path = pages.spaceChat.path({url})

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

// Every path whose latest event somebody else wrote and the reader has not opened since.
export const unreadPaths = derived(
  [app, latestActivityByPath, checked],
  ([$app, $latestActivityByPath, $checked]) => {
    const isUnread = (path: string, latestEvent: TrustedEvent) => {
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
      if (isUnread(path, event)) {
        paths.add(path)

        for (const branchPath of remove(path, getPaths(path.split("?")[0]))) {
          if (isUnread(branchPath, event)) {
            paths.add(branchPath)
          }
        }
      }
    }

    return paths
  },
)

// The unread paths the reader is not looking at, which is what the dots draw.
export const notifications = derived(
  [page, unreadPaths, deferredRoomPath],
  ([$page, $unreadPaths, $deferredRoomPath]) =>
    new Set(
      [...$unreadPaths].filter(p => !$page.url.pathname.startsWith(p) || p === $deferredRoomPath),
    ),
)

const countActivity = (activity: Map<string, Activity>, paths: Set<string>) =>
  [...activity.keys()].filter(path => paths.has(path)).length

export const unreadCount = derived(
  [latestActivityByPath, notifications],
  ([$latestActivityByPath, $notifications]) => countActivity($latestActivityByPath, $notifications),
)

export const backgroundUnreadCount = derived(
  [latestActivityByPath, unreadPaths],
  ([$latestActivityByPath, $unreadPaths]) => countActivity($latestActivityByPath, $unreadPaths),
)

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
  [latestActivityByPath, unreadPaths],
  ([$latestActivityByPath, $unreadPaths]) => {
    const byUrl = new Map<string, SpaceContent>()

    for (const {path, url, contentKind, event} of $latestActivityByPath.values()) {
      if (url && contentKind && $unreadPaths.has(path)) {
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
