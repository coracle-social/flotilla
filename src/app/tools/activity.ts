import {derived, readable} from "svelte/store"
import type {Readable} from "svelte/store"
import {page} from "$app/stores"
import {indexBy, remove} from "@welshman/lib"
import type {TrustedEvent} from "@welshman/util"
import {app} from "@app/core/app"
import {checked, getPaths, heldPaths, isChecked} from "@app/tools/checked"

// Where an activity happened. `contentKind` files one under a content item rather than a conversation.
export type Activity = {
  path: string
  event: TrustedEvent
  contentKind?: number
  url?: string
  h?: string
  pubkeys?: string[]
}

const sources: Readable<Activity[]>[] = []

// Each area hands over the latest activity at its own paths, so the join knows nothing about how any area works.
export const registerActivity = (source: Readable<Activity[]>) => {
  sources.push(source)
}

// Joined on first subscribe, since the areas register their sources after this module loads.
export const latestActivityByPath = readable(new Map<string, Activity>(), set =>
  derived(sources, $sources => indexBy(activity => activity.path, $sources.flat())).subscribe(set),
)

// Every path whose latest event somebody else wrote and the reader has not opened since.
export const unreadPaths = derived(
  [app, latestActivityByPath, checked],
  ([$app, $latestActivityByPath, $checked]) => {
    const isUnread = (path: string, latestEvent: TrustedEvent) =>
      latestEvent.pubkey !== $app.user?.pubkey && !isChecked($checked, path, latestEvent.created_at)

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
export const unreadDots = derived(
  [page, unreadPaths, heldPaths],
  ([$page, $unreadPaths, $heldPaths]) =>
    new Set([...$unreadPaths].filter(p => !$page.url.pathname.startsWith(p) || $heldPaths.has(p))),
)

const countActivity = (activity: Map<string, Activity>, paths: Set<string>) =>
  [...activity.keys()].filter(path => paths.has(path)).length

export const unreadCount = derived(
  [latestActivityByPath, unreadDots],
  ([$latestActivityByPath, $unreadDots]) => countActivity($latestActivityByPath, $unreadDots),
)

export const backgroundUnreadCount = derived(
  [latestActivityByPath, unreadPaths],
  ([$latestActivityByPath, $unreadPaths]) => countActivity($latestActivityByPath, $unreadPaths),
)
