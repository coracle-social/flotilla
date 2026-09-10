import {Resolver} from "@welshman/util"
import {EventWriter, FollowList, Note, Profile, RelayList} from "@welshman/domain"
import type {BaseEventReader, ConfiguredKind, EventQuery, KindFactory} from "@welshman/domain"
import type {Zooid} from "../zooid/relay"
import {tenantUrl} from "../zooid/config"
import type {OpenRelayName} from "../zooid/config"
import type {TestUser} from "../keys"
import {makePublisher} from "./publish"
import type {Enqueue, ProfileValues, SeededEvent, SeededTemplate} from "./publish"

// A nip-65 relay list, as the two sets a client reads off it: `write` is what an outbox-routed load
// for this pubkey resolves to, `read` is what a feed asks for that pubkey's context.
export type RelayListUrls = {
  read?: string[]
  write?: string[]
}

/**
 * One public relay's fixtures. Unlike a space it has no rooms, no members and nothing behind an
 * `h` tag: it holds the things a client reaches for by pubkey rather than by space — a relay list,
 * a follow list, a profile, a note.
 */
export type SeededOpenRelay = {
  readonly name: OpenRelayName
  // Known before seeding runs, since a relay list has to name the relay a note is seeded on.
  readonly url: string
  // Every relay list seeded here, which the scenario hands back to its own author as cache.
  readonly relayLists: SeededEvent[]
  note(user: TestUser, content: string, createdAt?: number): SeededEvent
  profile(user: TestUser, values: ProfileValues, createdAt?: number): SeededEvent
  // Where this user reads and writes. A relay a scenario expects the client to read from has to
  // appear in the reader's own list: zooid answers no REQ without nip-42, and Flotilla only
  // identifies to relays that list names.
  relayList(user: TestUser, urls: RelayListUrls, createdAt?: number): SeededEvent
  follows(user: TestUser, follows: TestUser[], createdAt?: number): SeededEvent
  event(user: TestUser, template: SeededTemplate, createdAt?: number): SeededEvent
  // This relay's domain kinds, bound to a resolver that answers with its url, the same way a
  // space's `kind()` does.
  kind<R extends BaseEventReader, W extends EventWriter<R>, Q extends EventQuery>(
    factory: KindFactory<R, W, Q>,
  ): ConfiguredKind<R, W, Q>
}

export type SeedOpenRelayOptions = {
  zooid: Zooid
  enqueue: Enqueue
  startedAt: number
  name: OpenRelayName
}

export const seedOpenRelay = ({
  zooid,
  enqueue,
  startedAt,
  name,
}: SeedOpenRelayOptions): SeededOpenRelay => {
  const url = tenantUrl(name)
  const relay = zooid.relay(name)
  const relayLists: SeededEvent[] = []
  const context = {resolver: new Resolver(() => [url])}

  const {event} = makePublisher({
    name,
    enqueue,
    startedAt,
    sign: (user, template) => relay.event(user, template),
  })

  const kind = <R extends BaseEventReader, W extends EventWriter<R>, Q extends EventQuery>(
    factory: KindFactory<R, W, Q>,
  ) => factory.configure(context)

  const note = (user: TestUser, content: string, createdAt = startedAt) =>
    event(user, () => kind(Note).writer().setContent(content).renderTemplate(), createdAt)

  const profile = (user: TestUser, values: ProfileValues, createdAt = startedAt) =>
    event(
      user,
      () => Profile.configure(context).writer().update(values).renderTemplate(),
      createdAt,
    )

  const relayList = (
    user: TestUser,
    {read = [], write = []}: RelayListUrls,
    createdAt = startedAt,
  ) => {
    const seeded = event(
      user,
      () => kind(RelayList).writer().setReadUrls(read).setWriteUrls(write).renderTemplate(),
      createdAt,
    )

    relayLists.push(seeded)

    return seeded
  }

  const follows = (user: TestUser, followed: TestUser[], createdAt = startedAt) =>
    event(
      user,
      () => {
        const writer = kind(FollowList).writer()

        for (const {pubkey} of followed) {
          writer.follow(pubkey)
        }

        return writer.renderTemplate()
      },
      createdAt,
    )

  return {name, url, relayLists, note, profile, relayList, follows, event, kind}
}
