import type {Maybe, MaybeAsync} from "@welshman/lib"
import type {EventTemplate, SignedEvent, StampedEvent} from "@welshman/util"
import type {TestUser} from "../keys"

// A queued write, drained in declaration order by `seed` in scenario.ts.
export type Enqueue = (write: () => Promise<void>) => void

// Seeding calls record what to write and return before anything is written.
export type SeededEvent = {
  readonly event: SignedEvent
  readonly id: string
}

// A domain writer needs a relay url to resolve its hints against, so anything it builds is deferred.
export type SeededTemplate = StampedEvent | (() => MaybeAsync<EventTemplate>)

// `write` is what an outbox-routed load resolves to, `read` is what a feed asks for that pubkey.
export type RelayListUrls = {
  read?: string[]
  write?: string[]
}

export type ProfileValues = {
  name?: string
  about?: string
  picture?: string
  nip05?: string
}

export type PublisherOptions = {
  // The relay these events are seeded into, for the error a read-too-early raises.
  name: string
  enqueue: Enqueue
  // The moment the scenario began. A fixture with no timestamp is stamped with it, not the wall clock.
  startedAt: number
  // Deferred, since a space's relay handle only exists once the queue has started draining.
  sign: (user: TestUser, template: StampedEvent) => Promise<SignedEvent>
}

// What to write is recorded now and published when `seed()` drains.
export const makePublisher = ({name, enqueue, startedAt, sign}: PublisherOptions) => {
  // Queues a write and hands back a getter for whatever it produced.
  const seeded = <T>(write: () => Promise<T>) => {
    let value: Maybe<T>

    enqueue(async () => {
      value = await write()
    })

    return () => {
      if (value) {
        return value
      }

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

  const event = (user: TestUser, template: SeededTemplate, createdAt = startedAt) =>
    publish(async () => {
      if (typeof template === "function") {
        return sign(user, {...(await template()), created_at: createdAt})
      }

      return sign(user, template)
    })

  return {seeded, publish, event}
}

export type Publisher = ReturnType<typeof makePublisher>
