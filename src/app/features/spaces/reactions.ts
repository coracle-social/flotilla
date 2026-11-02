import {tagSpec, tagValue} from "@welshman/util"
import type {EventContent, TrustedEvent} from "@welshman/util"
import {publishToRelays} from "@welshman/app"
import {deletes, reactions, relays} from "@app/core/plugins"

// A reaction travels the way its subject does: protected under NIP-70, and tagged into its room.
export const publishReaction = async (
  url: string,
  event: TrustedEvent,
  {content, tags}: EventContent,
) => {
  const relay = await relays.get().load(url)
  const h = tagValue(tagSpec("h"), event.tags)

  return reactions
    .get()
    .react(event, content, writer => {
      writer.addTags(...tags).setProtected(relay?.hasNip(70))

      // welshman tags the room only once the tracker knows the target's relay, which an unconfirmed message lacks.
      if (h) {
        writer.setRoom(url, h)
      }
    })
    .then(publishToRelays([url]))
}

export const retractReaction = async (url: string, reaction: TrustedEvent) => {
  const relay = await relays.get().load(url)
  return deletes
    .get()
    .deleteEvent(reaction, writer => writer.setProtected(relay?.hasNip(70)))
    .then(publishToRelays([url]))
}
