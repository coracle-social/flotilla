import {removeUndefined} from "@welshman/lib"
import {tagSpec, tagValue} from "@welshman/util"
import type {EventContent, TrustedEvent} from "@welshman/util"
import {deletes, reactions, relays, wraps} from "@app/core/plugins"

export type ReactionTarget = {
  url?: string
  // Where to publish, when it isn't just the space's own relay.
  urls?: string[]
}

// A reaction travels the way its subject does: protected under NIP-70, and tagged into its room.
export const publishReaction = async (
  event: TrustedEvent,
  {content, tags}: EventContent,
  {url, urls}: ReactionTarget,
) => {
  const protect = url ? await relays.get().hasNip(url, 70) : false
  const h = tagValue(tagSpec("h"), event.tags)
  const command = await reactions.get().react(event, content, writer => {
    writer.addTags(...tags).setProtected(protect)

    // welshman tags the room only once the tracker knows the target's relay, which an unconfirmed message lacks.
    if (url && h) {
      writer.setRoom(url, h)
    }
  })

  return command.publishToRelays(urls ?? removeUndefined([url]))
}

export const retractReaction = async (reaction: TrustedEvent, {url, urls}: ReactionTarget) => {
  const protect = url ? await relays.get().hasNip(url, 70) : false
  const command = await deletes.get().deleteEvent(reaction, writer => writer.setProtected(protect))

  return command.publishToRelays(urls ?? removeUndefined([url]))
}

// Chat reactions go out gift-wrapped to the conversation rather than to a relay.
export const publishWrappedReaction = async (
  event: TrustedEvent,
  {content, tags}: EventContent,
  pubkeys: string[],
) => {
  const command = await reactions.get().react(event, content, writer => writer.addTags(...tags))

  return wraps.get().publish({event: command.event, recipients: pubkeys, pow: 16})
}

export const retractWrappedReaction = async (reaction: TrustedEvent, pubkeys: string[]) => {
  const command = await deletes.get().deleteEvent(reaction)

  return wraps.get().publish({event: command.event, recipients: pubkeys, pow: 16})
}
