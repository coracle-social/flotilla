import {derived} from "svelte/store"
import {APP_DATA, sortEventsDesc, tagSpec, tagValues} from "@welshman/util"
import {AppData} from "@welshman/domain"
import {Relays, publish} from "@welshman/app"
import {command, fromApp, writer} from "@app/core"
import {deriveEventsForUrl} from "@app/repository"
import {toSpace} from "@app/rooms"

// NIP-78 app data from the pubkey the space's NIP-11 names, one ["content", <value>] tag per entry.
export const FEATURED_CONTENT_D = "flotilla/featured-content"

export const deriveFeaturedContent = (url: string) =>
  derived(
    [
      fromApp($app => $app.use(Relays).one(url)),
      deriveEventsForUrl(url, [{kinds: [APP_DATA], "#d": [FEATURED_CONTENT_D]}]),
    ],
    ([$relay, $events]) => {
      const [event] = sortEventsDesc($events.filter(e => e.pubkey === $relay?.pubkey))

      return tagValues(tagSpec("content"), event?.tags ?? [])
    },
  )

export const setFeaturedContent = async (url: string, content: string[]) => {
  const tags = content
    .map(value => value.trim())
    .filter(Boolean)
    .map(value => ["content", value])

  const eventWriter = writer(AppData)
    .setIdentifier(FEATURED_CONTENT_D)
    .addTags(...tags)

  return command(await toSpace(eventWriter, url)).then(publish)
}
