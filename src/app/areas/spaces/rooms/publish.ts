import * as nip19 from "nostr-tools/nip19"
import type {Maybe} from "@welshman/lib"
import {outbox, relay, seen, tagSpec, tagValue, toNostrURI} from "@welshman/util"
import type {EventContent, TrustedEvent} from "@welshman/util"
import {Comment, Message} from "@welshman/domain"
import type {BaseEventReader, EventWriter} from "@welshman/domain"
import {relays, router} from "@app/core/plugins"
import {command, writer} from "@app/core/domain"
import {loadSendDelay} from "@app/core/settings"
import {publishWithDelay} from "@app/tools/publish"

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
) => {
  const space = await relays.get().load(url)

  return eventWriter.setProtected(space?.hasNip(70)).forceRoutes(relay(url))
}

export const addressWriterToRoom = async <W extends EventWriter<BaseEventReader>>(
  eventWriter: W,
  url: string,
  h: string,
) => {
  await addressWriterToSpace(eventWriter, url)

  return eventWriter.setRoom(url, h)
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
  const eventWriter = writer(Message)
    .setContent(content)
    .addTags(...tags)

  if (h) {
    await addressWriterToRoom(eventWriter, url, h)
  } else {
    await addressWriterToSpace(eventWriter, url)
  }

  return command(eventWriter).then(publishWithDelay(delay))
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
  const eventWriter = writer(Comment)
    .setContent(content)
    .addTags(...tags)
    .setRootFromEvent(event)
    .setParentFromEvent(parent)
  const h = tagValue(tagSpec("h"), event.tags)

  if (h) {
    await addressWriterToRoom(eventWriter, url, h)
  } else {
    await addressWriterToSpace(eventWriter, url)
  }

  return command(eventWriter).then(publishWithDelay(await loadSendDelay()))
}
