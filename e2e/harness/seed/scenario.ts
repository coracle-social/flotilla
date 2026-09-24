import {int, now} from "@welshman/lib"
import type {MaybeAsync} from "@welshman/lib"
import {ROOMS, makeEvent} from "@welshman/util"
import type {SignedEvent} from "@welshman/util"
import type {Zooid} from "../zooid/relay"
import type {OpenRelayName, SpaceName} from "../zooid/config"
import {users} from "../keys"
import type {TestUser} from "../keys"
import {seedSpace} from "./space"
import type {SeededSpace} from "./space"
import {seedOpenRelay} from "./openRelay"
import type {SeededOpenRelay} from "./openRelay"

// A fixture timestamp as an offset from the scenario's start. `at(2, HOUR)` is two hours before it.
export type At = (count: number, unit: number) => number

export type SeedTools = {
  // Names a space the container already serves. Its policy is its toml in zooid/docker/config.
  relay: (name: SpaceName) => SeededSpace
  // Names one of the public relays, where the follow graph lives. See ARCHITECTURE.md, "The follow graph".
  open: (name: OpenRelayName) => SeededOpenRelay
  user: typeof users
  at: At
}

export type Scenario = {
  readonly startedAt: number
  readonly at: At
  // The spaces this scenario seeded, which are the relays the app is handed as its own.
  readonly urls: string[]
  // The open indexer when a scenario declared one, and the spaces otherwise.
  readonly indexerUrls: string[]
  space(name: SpaceName): SeededSpace
  open(name: OpenRelayName): SeededOpenRelay
  // A relay won't serve the list that would tell authPolicy it may identify to it.
  cache(user: TestUser): SignedEvent[]
}

export const seed = async (
  zooid: Zooid,
  build: (tools: SeedTools) => MaybeAsync<void>,
): Promise<Scenario> => {
  const startedAt = now()
  const at: At = (count, unit) => startedAt - int(count, unit)
  const spaces = new Map<string, SeededSpace>()
  const opened: SeededOpenRelay[] = []
  const writes: (() => Promise<void>)[] = []
  const roomLists = new Map<string, SignedEvent>()
  const relayLists = new Map<string, SignedEvent>()

  const enqueue = (write: () => Promise<void>) => writes.push(write)

  const relay = (name: SpaceName) => {
    const space = seedSpace({zooid, startedAt, name, enqueue})

    spaces.set(name, space)

    return space
  }

  const open = (name: OpenRelayName) => {
    const relay = seedOpenRelay({zooid, startedAt, name, enqueue})

    opened.push(relay)

    return relay
  }

  await build({relay, open, user: users, at})

  // Fixtures depend on one another, so the builder only records what to write and this drains it.
  for (const write of writes) {
    await write()
  }

  const seeded = Array.from(spaces.values())

  // A room list is replaceable and covers every space, so it is written after all of them are seeded.
  const membershipsByPubkey = new Map<string, {user: TestUser; urls: string[]; tags: string[][]}>()

  for (const space of seeded) {
    for (const {user, rooms} of space.memberships) {
      const membership = membershipsByPubkey.get(user.pubkey) ?? {user, urls: [], tags: []}

      membership.urls.push(space.url)
      membership.tags.push(["r", space.url], ...rooms.map(h => ["group", h, space.url]))
      membershipsByPubkey.set(user.pubkey, membership)
    }
  }

  for (const {user, urls, tags} of membershipsByPubkey.values()) {
    const event = await user.signer.sign(makeEvent(ROOMS, {tags, created_at: startedAt}))

    for (const url of urls) {
      await zooid.publish(url, event)
    }

    roomLists.set(user.pubkey, event)
  }

  for (const relay of opened) {
    for (const {event} of relay.relayLists) {
      relayLists.set(event.pubkey, event)
    }
  }

  const getSpace = (name: SpaceName) => {
    const space = spaces.get(name)

    if (space) {
      return space
    }

    throw new Error(`No space named "${name}" was seeded`)
  }

  const getOpenRelay = (name: OpenRelayName) => {
    const relay = opened.find(candidate => candidate.name === name)

    if (relay) {
      return relay
    }

    throw new Error(`No open relay named "${name}" was seeded`)
  }

  const cache = (user: TestUser) => {
    const events: SignedEvent[] = []
    const roomList = roomLists.get(user.pubkey)
    const relayList = relayLists.get(user.pubkey)

    if (roomList) {
      events.push(roomList)
    }
    if (relayList) {
      events.push(relayList)
    }

    return events
  }

  const urls = seeded.map(space => space.url)
  const indexers = opened.filter(relay => relay.name === "indexer").map(relay => relay.url)

  return {
    startedAt,
    at,
    cache,
    urls,
    indexerUrls: indexers.length > 0 ? indexers : urls,
    space: getSpace,
    open: getOpenRelay,
  }
}
