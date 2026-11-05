import * as nip19 from "nostr-tools/nip19"
import type {Maybe} from "@welshman/lib"
import {outbox, relay, seen, stamp, tagSpec, tagValue, toNostrURI} from "@welshman/util"
import type {EventContent, TrustedEvent} from "@welshman/util"
import {Comment, Message} from "@welshman/domain"
import type {BaseEventReader, EventWriter} from "@welshman/domain"
import {publish} from "@welshman/app"
import {publisher, relays, router} from "@app/core/plugins"
import {command, writer} from "@app/core/domain"
import {loadSendDelay} from "@app/core/settings"
import {SCHEDULE_UNSUPPORTED} from "@app/features/scheduling"

export const prependParent = async (
  parent: Maybe<TrustedEvent>,
  {content, tags}: EventContent,
  url?: string,
): Promise<EventContent> => {
  if (parent) {
    const resolver = router.get().resolver
    const relays = url ? [url] : await resolver.relays([seen(parent)])
    const hint = url ?? (await resolver.relay([outbox(parent.pubkey)])) ?? ""
    const uri = toNostrURI(nip19.neventEncode({id: parent.id, author: parent.pubkey, relays}))

    content = content ? uri + "\n\n" + content : uri
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
  const {content, tags} = await prependParent(parent, {content: "", tags: []}, url)
  const eventWriter = await addressWriterToSpace(
    writer(Message)
      .setContent(content)
      .addTags(...tags),
    url,
    h,
  )

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
  {
    url,
    h,
    shareToChat,
    scheduleAt,
  }: {url: string; h?: string; shareToChat?: boolean; scheduleAt?: number},
) => {
  const link = await addressWriterToSpace(eventWriter, url, h)

  // A scheduled post is dated ahead of now and handed to the space relay, which holds it until its time.
  const publication = scheduleAt
    ? publisher
        .get()
        .publish({relays: [url], event: stamp(await link.renderTemplate(), scheduleAt)})
    : await command(link).then(publish)

  const error = scheduleAt
    ? (await publication.getError()) && SCHEDULE_UNSUPPORTED
    : await publication.getError()

  // A thread scheduled for later has nothing yet to quote in the chat.
  if (shareToChat && !scheduleAt && !error) {
    publishRoomQuote({url, h, parent: publication.event})
  }

  return {publication, error}
}
