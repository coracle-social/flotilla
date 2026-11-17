import {first} from "@welshman/lib"
import {getAddress, isReplaceable, relay, userOutbox} from "@welshman/util"
import type {EventContent, TrustedEvent} from "@welshman/util"
import {Reaction} from "@welshman/domain"
import {publish} from "@welshman/app"
import {app} from "@app/core/app"
import {command, writer} from "@app/core/domain"
import {deletes} from "@app/core/plugins"

// A reaction is drawn from the repository the moment the publisher holds a copy, so its writer
// must not wait on the target author's relays to fill a hint or choose a route. The relay the note
// was seen on does both, and the user's outbox is what their follows read the reaction from.
export const makeReactionWriter = (event: TrustedEvent, content: string, tags: string[][]) => {
  const seen = Array.from(app.get().repository.tracker.getRelays(event.id))
  const hint = first(seen) ?? ""

  const eventWriter = writer(Reaction)
    .setContent(content)
    .addTags(
      ["e", event.id, hint],
      ["p", event.pubkey, hint],
      ["k", String(event.kind)],
      ...(isReplaceable(event) ? [["a", getAddress(event), hint]] : []),
      ...tags,
    )

  if (seen.length > 0) {
    eventWriter.forceRoutes(...seen.map(url => relay(url)), userOutbox())
  }

  return eventWriter
}

export const publishReaction = async (event: TrustedEvent, {content, tags}: EventContent) => {
  const publication = await command(makeReactionWriter(event, content, tags)).then(publish)

  // The reaction is in the repository before the relays answer, which is all a caller drawing it needs.
  await publication.written()

  return publication
}

export const retractReaction = (reaction: TrustedEvent) =>
  deletes.get().deleteEvent(reaction).then(publish)
