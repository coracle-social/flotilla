import {int, now} from "@welshman/lib"
import type {MaybeAsync} from "@welshman/lib"
import {ROOMS, makeEvent} from "@welshman/util"
import type {SignedEvent} from "@welshman/util"
import type {Zooid} from "../zooid/relay"
import type {TenantName} from "../zooid/config"
import {users} from "../keys"
import type {TestUser} from "../keys"
import {seedSpace} from "./space"
import type {SeededSpace} from "./space"

// A fixture timestamp, as an offset from the moment the scenario started. `at(2, HOUR)` is two
// hours before the test began, count-first like int and ago.
export type At = (count: number, unit: number) => number

export type SeedTools = {
  // Names a relay the container already serves. Its policy is its toml in zooid/docker/config.
  relay: (name: TenantName) => SeededSpace
  user: typeof users
  at: At
}

export type Scenario = {
  readonly startedAt: number
  readonly at: At
  readonly urls: string[]
  space(name: TenantName): SeededSpace
  // The events a returning user's client would already have on disk, which is just the room list.
  // A members-only relay won't serve the list that would tell authPolicy it may identify to it. See
  // ARCHITECTURE.md, "Users and sessions".
  cache(user: TestUser): SignedEvent[]
}

export const seed = async (
  zooid: Zooid,
  build: (tools: SeedTools) => MaybeAsync<void>,
): Promise<Scenario> => {
  const startedAt = now()
  const at: At = (count, unit) => startedAt - int(count, unit)
  const spaces = new Map<string, SeededSpace>()
  const writes: (() => Promise<void>)[] = []
  const roomLists = new Map<string, SignedEvent>()

  const relay = (name: TenantName) => {
    const space = seedSpace({
      zooid,
      startedAt,
      name,
      enqueue: write => writes.push(write),
    })

    spaces.set(name, space)

    return space
  }

  await build({relay, user: users, at})

  // Seeding is async and fixtures depend on one another, so the builder only records what to
  // write. Draining the queue here publishes each fixture in the order it was declared.
  for (const write of writes) {
    await write()
  }

  const seeded = Array.from(spaces.values())

  // A room list is replaceable and covers every space at once, so it can only be written after
  // all of them have been seeded.
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

  const getSpace = (name: TenantName) => {
    const space = spaces.get(name)

    if (space) return space

    throw new Error(`No space named "${name}" was seeded`)
  }

  const cache = (user: TestUser) => {
    const roomList = roomLists.get(user.pubkey)

    return roomList ? [roomList] : []
  }

  return {
    startedAt,
    at,
    cache,
    urls: seeded.map(space => space.url),
    space: getSpace,
  }
}
