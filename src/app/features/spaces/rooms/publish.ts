import * as nip19 from "nostr-tools/nip19"
import type {Maybe} from "@welshman/lib"
import {outbox, relay, seen, tagSpec, tagValue, toNostrURI} from "@welshman/util"
import type {EventContent, TrustedEvent} from "@welshman/util"
import {Comment, Message} from "@welshman/domain"
import type {BaseEventReader, EventWriter} from "@welshman/domain"
import {publish} from "@welshman/app"
import {publisher, relays, router} from "@app/core/plugins"
import {command, writer} from "@app/core/domain"
import {loadSendDelay} from "@app/core/settings"

export const prependParent = async (
  parent: Maybe<TrustedEvent>,
  {content, tags}: EventContent,
  url?: string,
): Promise<EventContent> => {
  if (parent) {
    const resolver = router.get().resolver
    const relays = url ? [url] : await resolver.relays([seen(parent)])
    const hint = url ?? (await resolver.relay([outbox(parent.pubkey)])) ?? ""
    const nevent = nip19.neventEncode({id: parent.id, author: parent.pubkey, relays})

    content = toNostrURI(nevent) + "\n\n" + content
    tags = [...tags, ["q", parent.id, hint, parent.pubkey], ["p", parent.pubkey, hint]]
  }

  return {content, tags}
}

export const addressWriterToSpace = async <W extends EventWriter<BaseEventReader>>(
  eventWriter: W,
  url: string,
  h?: string,
) => {
  const space = await relays.get().load(url)

  eventWriter.setProtected(space?.hasNip(70))

  if (h) {
    eventWriter.setRoom(url, h)
  } else {
    eventWriter.forceRoutes(relay(url))
  }

  return eventWriter
}

export const publishRoomQuote = async ({
  url,
  h,
  parent,
  delay,
}: {
  url: string
  h?: string
  parent: TrustedEvent
  delay?: number
}) => {
  const eventWriter = await addressWriterToSpace(writer(Message).setParent(parent), url, h)

  return publisher.get().publish({
    relays: [url],
    event: await eventWriter.renderTemplate(),
    delay,
  })
}

export const publishComment = async ({
  url,
  event,
  parent = event,
  content,
  tags,
}: EventContent & {
  url: string
  event: TrustedEvent
  parent?: TrustedEvent
}) => {
  const eventWriter = await addressWriterToSpace(
    writer(Comment)
      .setContent(content)
      .addTags(...tags)
      .setRootFromEvent(event)
      .setParentFromEvent(parent),
    url,
    tagValue(tagSpec("h"), event.tags),
  )

  return publisher.get().publish({
    relays: [url],
    event: await eventWriter.renderTemplate(),
    delay: await loadSendDelay(),
  })
}

export const publishToSpace = async (
  eventWriter: EventWriter<BaseEventReader>,
  {url, h, shareToChat}: {url: string; h?: string; shareToChat?: boolean},
) => {
  const publication = await command(await addressWriterToSpace(eventWriter, url, h)).then(publish)
  const error = await publication.getError()

  if (shareToChat && !error) {
    publishRoomQuote({url, h, parent: publication.event})
  }

  return {publication, error}
}
