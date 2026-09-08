import {derived} from "svelte/store"
import {sortBy} from "@welshman/lib"
import {allNotifications, latestActivityByPath} from "@app/notifications"

// Every room, space chat and direct message with something unread, newest first. The inbox shows
// exactly what the badges show, so reading a conversation is what takes it out of the list.
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

// What a space has waiting that isn't a message: threads, events, classifieds and the rest,
// counted only where they're unread, since a total would be the same number every day.
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
