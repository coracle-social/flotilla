import {derived} from "svelte/store"
import {APP_DATA, tagSpec, tagValues, relay} from "@welshman/util"
import {AppData} from "@welshman/domain"
import {Domain} from "@welshman/app"
import {app} from "@app/core"
import {deriveRelaySignedEvents} from "@app/repository"

// NIP-78 app data published by the relay's self key. Each featured entry is a
// ["content", <value>] tag (freeform text, intended to be a url or nevent).
export const FEATURED_CONTENT_D = "flotilla/featured-content"

export const deriveFeaturedContent = (url: string) =>
  derived(
    deriveRelaySignedEvents(url, [{kinds: [APP_DATA], "#d": [FEATURED_CONTENT_D]}]),
    ([event]) => tagValues(tagSpec("content"), event?.tags ?? []),
  )

// Publish the featured content list by asking the relay to sign it with its self
// key (the unofficial NIP-86 "signevent" method).
export const setFeaturedContent = async (url: string, content: string[]) => {
  const tags = content
    .map(value => value.trim())
    .filter(Boolean)
    .map(value => ["content", value])

  const writer = app
    .get()
    .use(Domain)
    .writer(AppData)
    .forceRoutes(relay(url))
    .setIdentifier(FEATURED_CONTENT_D)
    .addTags(...tags)

  const command = await app.get().use(Domain).command(writer)

  return command.publishAsRelay(url)
}
