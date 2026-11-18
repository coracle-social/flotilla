import {derived} from "svelte/store"
import {first, groupBy, identity, spec} from "@welshman/lib"
import type {TrustedEvent} from "@welshman/util"
import {MESSAGE, sortEventsDesc, tagSpec, tagValue} from "@welshman/util"
import {throttled} from "@welshman/store"
import {Events, Relays} from "@welshman/app"
import {makeCommentFilter} from "@lib/util"
import {fromApp} from "@app/core/app"
import {relays} from "@app/core/plugins"
import {getIsMuted, userSettingsValues} from "@app/core/settings"
import {activeSpaceUrls} from "@app/core/user"
import * as pages from "@app/navigation/pages"
import {getActivityTarget} from "@app/navigation/locations"
import type {Activity} from "@app/tools/activity"
import {CONTENT_KINDS} from "@app/tools/content"

// The content item an event belongs to, when it belongs to one at all.
const getContentTarget = (event: TrustedEvent) => {
  const target = getActivityTarget(event)

  if (CONTENT_KINDS.includes(target.kind)) {
    return target
  }
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

// The latest message in each room or in the space's chat, and on each content item, in every active space.
export const spaceActivity = derived(
  throttled(
    1000,
    derived(
      [
        activeSpaceUrls,
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
  ([$activeSpaceUrls, , eventsByIdByUrl, $settings]) => {
    const activity: Activity[] = []

    for (const url of $activeSpaceUrls) {
      const events = sortEventsDesc((eventsByIdByUrl.get(url) || new Map()).values())
      // A conversation is its own messages; content and its comments carry the room h but belong to the item.
      const messages = events.filter(spec({kind: MESSAGE}))

      if (relays.get().get(url)?.hasNip(29)) {
        for (const [h, [event]] of groupBy(e => tagValue(tagSpec("h"), e.tags), messages)) {
          // A muted room is left out entirely, so it can't light up its own badge or the space's
          if (h && !getIsMuted($settings, url, h)) {
            activity.push({path: pages.room.path({url, h}), url, h, event})
          }
        }
      } else {
        const event = first(messages)

        if (event) {
          activity.push({path: pages.spaceChat.path({url}), url, event})
        }
      }

      activity.push(...latestContentActivity(url, events).values())
    }

    return activity
  },
)
