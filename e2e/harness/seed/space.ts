import {neventEncode} from "nostr-tools/nip19"
import type {Maybe} from "@welshman/lib"
import {
  MESSAGE,
  ROOM_ADD_MEMBER,
  Resolver,
  makeEvent,
  prep,
  tagSpec,
  tagValue,
  toNostrURI,
} from "@welshman/util"
import type {HashedEvent} from "@welshman/util"
import {Nip59} from "@welshman/signer"
import {DirectMessage, EventWriter, MessagingRelayList, Profile, RelayList} from "@welshman/domain"
import type {BaseEventReader, ConfiguredKind, EventQuery, KindFactory} from "@welshman/domain"
import type {RoomOptions, TestRelay} from "../zooid/types"
import type {Zooid} from "../zooid/relay"
import {tenantUrl} from "../zooid/config"
import type {SpaceName} from "../zooid/config"
import {users} from "../keys"
import type {TestUser} from "../keys"
import {makePublisher} from "./publish"
import type {Enqueue, ProfileValues, RelayListUrls, SeededEvent, SeededTemplate} from "./publish"

// @welshman/domain has no writer for NIP-29 kind-9 messages, so this pairs the base writer and reader.
class MessageWriter extends EventWriter<BaseEventReader> {}

// The kind-14 a direct message really is. It is never published, since each participant gets a wrap.
export type SeededRumor = {
  readonly rumor: HashedEvent
  readonly id: string
}

// A user's membership as their own client sees it, turned into a room list once every space is seeded.
export type SeededMembership = {
  user: TestUser
  rooms: string[]
}

export type SeededSpace = {
  readonly name: SpaceName
  readonly url: string
  readonly memberships: SeededMembership[]
  room(h: string, options?: RoomOptions): void
  member(user: TestUser, h?: string): void
  // Relay and room membership, plus a place in the user's own room list.
  join(user: TestUser, ...rooms: string[]): void
  message(user: TestUser, h: string, content: string, createdAt?: number): SeededEvent
  reply(user: TestUser, parent: SeededEvent, content: string, createdAt?: number): SeededEvent
  profile(user: TestUser, values: ProfileValues, createdAt?: number): SeededEvent
  // Outbox routing resolves everything about a person through their relay list.
  relayList(user: TestUser, urls?: RelayListUrls, createdAt?: number): SeededEvent
  // Having one is what makes a person reachable, so messaging being off is a person without one.
  messagingRelayList(user: TestUser, urls?: string[], createdAt?: number): SeededEvent
  event(user: TestUser, template: SeededTemplate, createdAt?: number): SeededEvent
  // One kind-14 rumor, gift-wrapped once per participant including the sender.
  dm(from: TestUser, to: TestUser[], content: string, createdAt?: number): SeededRumor
  // This space's domain kinds, bound to a resolver that answers with its url.
  kind<R extends BaseEventReader, W extends EventWriter<R>, Q extends EventQuery>(
    factory: KindFactory<R, W, Q>,
  ): ConfiguredKind<R, W, Q>
}

export type SeedSpaceOptions = {
  zooid: Zooid
  enqueue: Enqueue
  // A fixture declared without a timestamp is stamped with the scenario's start, not the wall clock.
  startedAt: number
  name: SpaceName
}

export const seedSpace = ({zooid, enqueue, startedAt, name}: SeedSpaceOptions): SeededSpace => {
  const memberships: SeededMembership[] = []
  // Known before seeding runs, unlike the relay handle below, so another relay's fixture can name it.
  const url = tenantUrl(name)

  let testRelay: Maybe<TestRelay>

  const relay = () => {
    if (testRelay) {
      return testRelay
    }

    throw new Error(`Space "${name}" has not been seeded yet, await seed() first`)
  }

  enqueue(async () => {
    testRelay = await zooid.relay(name)
  })

  const {seeded, publish, event} = makePublisher({
    name,
    enqueue,
    startedAt,
    sign: (user, template) => relay().event(user, template),
  })

  // Every fixture is published to this space, so a relay hint always resolves to its url.
  const context = {resolver: new Resolver(() => [url])}

  const room = (h: string, roomOptions: RoomOptions = {}) =>
    enqueue(() => relay().room(h, roomOptions, startedAt))

  const member = (user: TestUser, h?: string) => enqueue(() => relay().member(user, h, startedAt))

  const join = (user: TestUser, ...roomIds: string[]) => {
    memberships.push({user, rooms: roomIds})
    member(user)

    for (const h of roomIds) {
      event(
        users.admin,
        makeEvent(ROOM_ADD_MEMBER, {
          created_at: startedAt,
          tags: [
            ["h", h],
            ["p", user.pubkey],
          ],
        }),
      )
    }
  }

  const message = (user: TestUser, h: string, content: string, createdAt = startedAt) =>
    publish(() => relay().message(user, h, content, createdAt))

  // Content.svelte renders a quote from the nostr uri rather than the q tag, as prependParent does.
  const reply = (user: TestUser, parent: SeededEvent, content: string, createdAt = startedAt) =>
    event(
      user,
      async () => {
        const h = tagValue(tagSpec("h"), parent.event.tags)

        if (h) {
          const nevent = neventEncode({...parent.event, relays: [url]})

          return new MessageWriter(MESSAGE, context)
            .setRoom(url, h)
            .addQuote(parent.event)
            .addMention(parent.event.pubkey)
            .setContent(toNostrURI(nevent) + "\n\n" + content)
            .renderTemplate()
        }

        throw new Error(`Cannot reply to ${parent.id}, it is not in a room`)
      },
      createdAt,
    )

  const profile = (user: TestUser, values: ProfileValues, createdAt = startedAt) =>
    event(
      user,
      () => Profile.configure(context).writer().update(values).renderTemplate(),
      createdAt,
    )

  const kind = <R extends BaseEventReader, W extends EventWriter<R>, Q extends EventQuery>(
    factory: KindFactory<R, W, Q>,
  ) => factory.configure(context)

  const relayList = (
    user: TestUser,
    {read = [url], write = [url]}: RelayListUrls = {},
    createdAt = startedAt,
  ) =>
    event(
      user,
      () => kind(RelayList).writer().setReadUrls(read).setWriteUrls(write).renderTemplate(),
      createdAt,
    )

  const messagingRelayList = (user: TestUser, urls = [url], createdAt = startedAt) =>
    event(user, () => kind(MessagingRelayList).writer().setUrls(urls).renderTemplate(), createdAt)

  // A gift wrap's author is an ephemeral key nobody here can authenticate as, so the sender sends it.
  const dm = (from: TestUser, to: TestUser[], content: string, createdAt = startedAt) => {
    const rumor = seeded(async () => {
      const writer = kind(DirectMessage).writer().setContent(content)

      for (const user of to) {
        writer.addRecipient(user.pubkey)
      }

      const template = {...(await writer.renderTemplate()), created_at: createdAt}
      const nip59 = Nip59.fromSigner(from.signer)

      for (const {pubkey} of [from, ...to]) {
        await relay().publish(await nip59.wrap(pubkey, template), {as: from})
      }

      // The same template the wraps were built from, so this is the id they decrypt to.
      return prep(template, from.pubkey)
    })

    return {
      get rumor() {
        return rumor()
      },
      get id() {
        return rumor().id
      },
    }
  }

  return {
    name,
    url,
    memberships,
    room,
    member,
    join,
    message,
    reply,
    profile,
    relayList,
    messagingRelayList,
    event,
    dm,
    kind,
  }
}
