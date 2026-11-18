import {tagSpec, tagValue} from "@welshman/util"
import type {EventContent, TrustedEvent} from "@welshman/util"
import {publishToRelays} from "@welshman/app"
import {command} from "@app/core/domain"
import {deletes, relays} from "@app/core/plugins"
import {makeReactionWriter} from "@app/tools/interactions/reactions"

// A reaction to a room message is drawn from the repository immediately, so its writer names the
// relay the message was seen on rather than resolving the author's relays first.
export const publishReaction = async (
  url: string,
  event: TrustedEvent,
  {content, tags}: EventContent,
) => {
  const relay = await relays.get().load(url)
  const h = tagValue(tagSpec("h"), event.tags)
  const eventWriter = makeReactionWriter(event, content, tags).setProtected(relay?.hasNip(70))

  if (h) {
    eventWriter.setRoom(url, h)
  }

  const publication = await command(eventWriter).then(publishToRelays([url]))

  // The reaction is in the repository before the relays answer, which is all a caller drawing it needs.
  await publication.written()

  return publication
}

export const retractReaction = async (url: string, reaction: TrustedEvent) => {
  const relay = await relays.get().load(url)
  return deletes
    .get()
    .deleteEvent(reaction, writer => writer.setProtected(relay?.hasNip(70)))
    .then(publishToRelays([url]))
}
