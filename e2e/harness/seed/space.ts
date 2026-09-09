import {neventEncode} from "nostr-tools/nip19"
import type {Maybe, MaybeAsync} from "@welshman/lib"
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
import type {EventTemplate, HashedEvent, SignedEvent, StampedEvent} from "@welshman/util"
import {Nip59} from "@welshman/signer"
import {DirectMessage, EventWriter, Profile} from "@welshman/domain"
import type {BaseEventReader, ConfiguredKind, EventQuery, KindFactory} from "@welshman/domain"
import type {RoomOptions, TestRelay} from "../zooid/types"
import type {Zooid} from "../zooid/relay"
import type {TenantName} from "../zooid/config"
import {users} from "../keys"
import type {TestUser} from "../keys"

// @welshman/domain has no writer for NIP-29 kind-9 messages, and none of its readers describe one,
// so this pairs the base writer with the base reader. The behavior tags it renders are everything a
// room message carries: `h` via setRoom, `q` and `p` via addQuote and addMention.
class MessageWriter extends EventWriter<BaseEventReader> {}

// A handle to an event the scenario is going to publish. Seeding calls record what to write and
// return before anything is written, so the event is filled in when its turn in the queue comes up.
export type SeededEvent = {
  readonly event: SignedEvent
  readonly id: string
}

// The kind-14 a direct message really is. It is never published, since each participant gets it
// inside a gift wrap, so this is what a spec asserts on.
export type SeededRumor = {
  readonly rumor: HashedEvent
  readonly id: string
}

// An event to seed, either already rendered or built when its turn comes up. A domain writer needs
// a relay url to resolve its hints against, and this space has none until the queue has drained,
// so anything built by one has to be deferred.
export type SeededTemplate = StampedEvent | (() => MaybeAsync<EventTemplate>)

export type ProfileValues = {
  name?: string
  about?: string
  picture?: string
  nip05?: string
}

// A queued write, drained in declaration order by `seed` in scenario.ts.
export type Enqueue = (write: () => Promise<void>) => void

// A user's membership as their own client sees it, which the scenario turns into one room list
// per user once every space has been seeded.
export type SeededMembership = {
  user: TestUser
  rooms: string[]
}

export type SeededSpace = {
  readonly name: TenantName
  // The url is read off the relay handle, so this only reads once seeding has run.
  readonly url: string
  readonly memberships: SeededMembership[]
  room(h: string, options?: RoomOptions): void
  member(user: TestUser, h?: string): void
  // Relay and room membership, plus a place in the user's own room list, which is what a user who
  // joined this space through the ui ends up with.
  join(user: TestUser, ...rooms: string[]): void
  message(user: TestUser, h: string, content: string, createdAt?: number): SeededEvent
  reply(user: TestUser, parent: SeededEvent, content: string, createdAt?: number): SeededEvent
  profile(user: TestUser, values: ProfileValues, createdAt?: number): SeededEvent
  event(user: TestUser, template: SeededTemplate, createdAt?: number): SeededEvent
  // A nip-17 conversation. One kind-14 rumor, gift-wrapped once per participant including the
  // sender, whose own copy is the half of the thread their client reads back.
  dm(from: TestUser, to: TestUser[], content: string, createdAt?: number): SeededRumor
  // This space's domain kinds, bound to a resolver that answers with its url, so a writer built
  // here renders its relay hints as this space. For everything `event()` takes a template for:
  // `space.event(user, () => space.kind(Article).writer().setTitle("x").renderTemplate())`.
  kind<R extends BaseEventReader, W extends EventWriter<R>, Q extends EventQuery>(
    factory: KindFactory<R, W, Q>,
  ): ConfiguredKind<R, W, Q>
}

export type SeedSpaceOptions = {
  zooid: Zooid
  enqueue: Enqueue
  // The moment the scenario began. A fixture declared without a timestamp is stamped with it
  // rather than with the wall clock.
  startedAt: number
  name: TenantName
}

export const seedSpace = ({zooid, enqueue, startedAt, name}: SeedSpaceOptions): SeededSpace => {
  const memberships: SeededMembership[] = []

  let testRelay: Maybe<TestRelay>

  const relay = () => {
    if (testRelay) return testRelay

    throw new Error(`Space "${name}" has not been seeded yet, await seed() first`)
  }

  enqueue(async () => {
    testRelay = await zooid.relay(name)
  })

  // Every fixture is published to this space, so a relay hint always resolves to its url.
  const context = {resolver: new Resolver(() => [relay().url])}

  // Queues a write and hands back a getter for whatever it produced, which only reads once the
  // scenario's queue has drained.
  const seeded = <T>(write: () => Promise<T>) => {
    let value: Maybe<T>

    enqueue(async () => {
      value = await write()
    })

    return () => {
      if (value) return value

      throw new Error(`An event seeded into "${name}" was read before seed() published it`)
    }
  }

  const publish = (write: () => Promise<SignedEvent>): SeededEvent => {
    const event = seeded(write)

    return {
      get event() {
        return event()
      },
      get id() {
        return event().id
      },
    }
  }

  const publishTemplate = (user: TestUser, build: () => MaybeAsync<StampedEvent>) =>
    publish(async () => relay().event(user, await build()))

  const room = (h: string, roomOptions: RoomOptions = {}) =>
    enqueue(() => relay().room(h, roomOptions, startedAt))

  const member = (user: TestUser, h?: string) => enqueue(() => relay().member(user, h, startedAt))

  const event = (user: TestUser, template: SeededTemplate, createdAt = startedAt) =>
    publishTemplate(user, async () => {
      if (typeof template === "function") {
        return {...(await template()), created_at: createdAt}
      }

      return template
    })

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

  // Flotilla replies in a room by quoting. Content.svelte renders a quote from the nostr uri in the
  // content rather than from the q tag, so the uri is prepended as prependParent does in
  // src/app/rooms.ts.
  const reply = (user: TestUser, parent: SeededEvent, content: string, createdAt = startedAt) =>
    publishTemplate(user, async () => {
      const h = tagValue(tagSpec("h"), parent.event.tags)

      if (h) {
        const url = relay().url
        const nevent = neventEncode({...parent.event, relays: [url]})
        const template = await new MessageWriter(MESSAGE, context)
          .setRoom(url, h)
          .addQuote(parent.event)
          .addMention(parent.event.pubkey)
          .setContent(toNostrURI(nevent) + "\n\n" + content)
          .renderTemplate()

        return {...template, created_at: createdAt}
      }

      throw new Error(`Cannot reply to ${parent.id}, it is not in a room`)
    })

  const profile = (user: TestUser, values: ProfileValues, createdAt = startedAt) =>
    publishTemplate(user, async () => ({
      ...(await Profile.configure(context).writer().update(values).renderTemplate()),
      created_at: createdAt,
    }))

  const kind = <R extends BaseEventReader, W extends EventWriter<R>, Q extends EventQuery>(
    factory: KindFactory<R, W, Q>,
  ) => factory.configure(context)

  // Every wrap is published over the sender's own connection, since a gift wrap's author is an
  // ephemeral key nobody in this process can authenticate as. zooid stores it anyway, authorizing a
  // kind-1059 by the member named in its p tag.
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
    get url() {
      return relay().url
    },
    memberships,
    room,
    member,
    join,
    message,
    reply,
    profile,
    event,
    dm,
    kind,
  }
}
