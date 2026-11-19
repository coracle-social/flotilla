import * as nip19 from "nostr-tools/nip19"
import {uniq} from "@welshman/lib"
import type {Maybe, MaybeAsync} from "@welshman/lib"
import {outbox, relay, seen, tagSpec, tagValue, toNostrURI} from "@welshman/util"
import type {EventContent, TrustedEvent} from "@welshman/util"
import {Comment, Message} from "@welshman/domain"
import type {BaseEventReader, EventWriter} from "@welshman/domain"
import type {Command} from "@welshman/app"
import {UserError} from "@lib/util"
import {publisher, relays, router} from "@app/core/plugins"
import {command, writer} from "@app/core/domain"
import {requireUser} from "@app/core/user"
import {loadSendDelay} from "@app/core/settings"
import {INDEXER_RELAYS, SCHEDULER_RELAY} from "@app/core/env"

type Modifier<W> = (eventWriter: W) => MaybeAsync<unknown>

// Each step does nothing when given undefined, so callers can pass optional props straight through.
export class PublishBuilder<W extends EventWriter<BaseEventReader>> {
  scheduleAt?: number
  url?: string
  h?: string
  delay?: number
  modifiers: Modifier<W>[] = []
  quote = false

  constructor(readonly eventWriter: W) {}

  schedule(at?: number) {
    this.scheduleAt = at

    return this
  }

  toSpace(url?: string) {
    this.url = url

    return this
  }

  toRoom(h?: string) {
    this.h = h

    return this
  }

  withDelay(delay?: number) {
    this.delay = delay

    return this
  }

  // Modifiers run after the relays are chosen, so they can read them.
  modify(modifier: Modifier<W>) {
    this.modifiers.push(modifier)

    return this
  }

  shareToChat(share?: boolean) {
    this.quote = Boolean(share)

    return this
  }

  async publish() {
    const {eventWriter, scheduleAt, url, h, delay} = this

    // Checked before the writer changes, so a publish retried after logging in starts clean.
    requireUser()

    // The scheduler relay holds a post dated ahead of now, and forwards it to the author's relays when it's due.
    if (scheduleAt) {
      eventWriter.setCreatedAt(scheduleAt).forceRoutes(relay(SCHEDULER_RELAY))
    }

    // A space relay holds a scheduled post itself, so its route replaces the scheduler's.
    if (url) {
      const space = await relays.get().load(url)

      eventWriter.setProtected(space?.hasNip(70)).forceRoutes(relay(url))
    }

    if (url && h) {
      eventWriter.setRoom(url, h)
    } else if (h) {
      throw new Error("A room needs a space")
    }

    for (const modifier of this.modifiers) {
      await modifier(eventWriter)
    }

    const {event, relays: urls} = await command(eventWriter)
    const publication = publisher.get().publish({event, relays: urls, delay})

    // A post scheduled for later has nothing yet to quote in the chat.
    if (url && this.quote && !scheduleAt) {
      publication.getFatalError().then(error => {
        if (!error) {
          publishRoomQuote({url, h, parent: publication.event})
        }
      })
    }

    return publication
  }
}

export class ScheduleError extends UserError {}

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

  return new PublishBuilder(eventWriter).toSpace(url).toRoom(h).withDelay(delay).publish()
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

  return new PublishBuilder(eventWriter)
    .toSpace(url)
    .toRoom(tagValue(tagSpec("h"), event.tags))
    .withDelay(await loadSendDelay())
    .publish()
}

// Room lists also go to the indexers, which is where the space browser looks for them.
export const publishRoomList = (command: Command) =>
  command.publishToRelays(uniq([...command.relays, ...INDEXER_RELAYS]))
