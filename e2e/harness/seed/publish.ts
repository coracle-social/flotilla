import type {Maybe, MaybeAsync} from "@welshman/lib"
import type {EventTemplate, SignedEvent, StampedEvent} from "@welshman/util"
import type {TestUser} from "../keys"

// A queued write, drained in declaration order by `seed` in scenario.ts.
export type Enqueue = (write: () => Promise<void>) => void

// A handle to an event the scenario is going to publish. Seeding calls record what to write and
// return before anything is written, so the event is filled in when its turn in the queue comes up.
export type SeededEvent = {
  readonly event: SignedEvent
  readonly id: string
}

// An event to seed, either already rendered or built when its turn comes up. A domain writer needs
// a relay url to resolve its hints against, and a relay has none until the queue has drained, so
// anything built by one has to be deferred.
export type SeededTemplate = StampedEvent | (() => MaybeAsync<EventTemplate>)

// A nip-65 relay list, as the two sets a client reads off it: `write` is what an outbox-routed load
// for this pubkey resolves to, `read` is what a feed asks for that pubkey's context.
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
  // The moment the scenario began. A fixture declared without a timestamp is stamped with it
  // rather than with the wall clock, so two fixtures describing the same thing cannot land
  // seconds apart and decide which of them wins.
  startedAt: number
  // How an event this process signs reaches the relay, deferred because a space's relay handle
  // only exists once the queue has started draining.
  sign: (user: TestUser, template: StampedEvent) => Promise<SignedEvent>
}

// The queue every seeding call goes through: what to write is recorded now and published when
// `seed()` drains, and what it produced only reads back after that.
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
