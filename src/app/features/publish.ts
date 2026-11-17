import {get} from "svelte/store"
import {uniq} from "@welshman/lib"
import {stamp} from "@welshman/util"
import {PollWriter} from "@welshman/domain"
import type {BaseEventReader, EventWriter} from "@welshman/domain"
import {PublishStatus} from "@welshman/net"
import {publisher} from "@app/core/plugins"
import {SCHEDULER_RELAY} from "@app/core/env"
import {userSpaceUrls} from "@app/features/spaces"
import {SCHEDULE_UNSUPPORTED} from "@app/features/scheduling"

// publishToSpace's counterpart: a post with no space behind it goes to the author's relays and spaces.
// A scheduled one is dated ahead of now and handed to the scheduler relay, which forwards it when due.
export const publishToNetwork = async (
  eventWriter: EventWriter<BaseEventReader>,
  scheduleAt?: number,
) => {
  const relays = scheduleAt
    ? [SCHEDULER_RELAY]
    : uniq([...(await eventWriter.relays()), ...get(userSpaceUrls)])

  // A poll names the relays its votes live on, which are the ones it goes out to.
  if (eventWriter instanceof PollWriter) {
    eventWriter.setUrls(relays)
  }

  const publication = publisher
    .get()
    .publish({event: stamp(await eventWriter.renderTemplate(), scheduleAt), relays})

  await publication.settled()

  if (publication.getUrlsWithStatus(PublishStatus.Success).length > 0) {
    return {publication}
  }

  const error = scheduleAt
    ? SCHEDULE_UNSUPPORTED
    : ((await publication.getError()) ?? "Failed to post.")

  return {publication, error}
}
