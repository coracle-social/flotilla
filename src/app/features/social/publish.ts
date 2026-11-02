import {get} from "svelte/store"
import {uniq} from "@welshman/lib"
import {PollWriter} from "@welshman/domain"
import type {BaseEventReader, EventWriter} from "@welshman/domain"
import {PublishStatus} from "@welshman/net"
import {publisher} from "@app/core/plugins"
import {userSpaceUrls} from "@app/features/spaces"

// publishToSpace's counterpart: a post with no space behind it goes to the author's relays and spaces.
export const publishToNetwork = async (eventWriter: EventWriter<BaseEventReader>) => {
  const relays = uniq([...(await eventWriter.relays()), ...get(userSpaceUrls)])

  // A poll names the relays its votes live on, which are the ones it goes out to.
  if (eventWriter instanceof PollWriter) {
    eventWriter.setUrls(relays)
  }

  const publication = publisher.get().publish({event: await eventWriter.renderTemplate(), relays})

  await publication.settled()

  if (publication.getUrlsWithStatus(PublishStatus.Success).length > 0) {
    return {publication}
  }

  return {publication, error: (await publication.getError()) ?? "Failed to post."}
}
