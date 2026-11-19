import {tagSpec, tagValue} from "@welshman/util"
import type {EventContent, TrustedEvent} from "@welshman/util"
import {Delete} from "@welshman/domain"
import {writer} from "@app/core/domain"
import {PublishBuilder} from "@app/tools/publish"
import {makeReactionWriter} from "@app/tools/interactions/reactions"

// A reaction to a room message is drawn from the repository immediately, so its writer names the
// relay the message was seen on rather than resolving the author's relays first.
export const publishReaction = async (
  url: string,
  event: TrustedEvent,
  {content, tags}: EventContent,
) => {
  const publication = await new PublishBuilder(makeReactionWriter(event, content, tags))
    .toSpace(url)
    .toRoom(tagValue(tagSpec("h"), event.tags))
    .publish()

  // The reaction is in the repository before the relays answer, which is all a caller drawing it needs.
  await publication.written()

  return publication
}

export const retractReaction = (url: string, reaction: TrustedEvent) =>
  new PublishBuilder(writer(Delete).addEvent(reaction, url)).toSpace(url).publish()
