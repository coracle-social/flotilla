import {derived} from "svelte/store"
import {formatTimestampAsTime, LOCALE, now, secondsToDate, sortBy} from "@welshman/lib"
import {latestActivityByPath, unreadPaths} from "@app/tools/activity"
import type {Activity} from "@app/tools/activity"

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
