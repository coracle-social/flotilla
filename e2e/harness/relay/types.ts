import type {SignedEvent, StampedEvent} from "@welshman/util"
import type {ClientMessage, RelayMessage} from "@welshman/net"
import type {TestUser} from "../keys"
import type {TenantName} from "./config"

export type PublishOptions = {
  // Which identity the seeding connection authenticates as, defaulting to the event's own author.
  as?: TestUser
}

export type RoomOptions = {
  name?: string
  about?: string
  picture?: string
  closed?: boolean
  private?: boolean
}

// Every seeding call publishes over a real socket, so the relay stores what it would for a client.
export type TestRelay = {
  readonly name: string
  readonly url: string
  room(h: string, options: RoomOptions, createdAt: number): Promise<void>
  message(user: TestUser, h: string, content: string, createdAt: number): Promise<SignedEvent>
  // Grants relay membership, and room membership too when `h` is given.
  member(user: TestUser, h: string | undefined, createdAt: number): Promise<void>
  // Escape hatch for kinds with no affordance of their own: profiles, reactions, threads, DMs.
  event(user: TestUser, event: StampedEvent): Promise<SignedEvent>
  // An event this process did not sign, sent over `as`'s connection, which a gift wrap needs.
  publish(event: SignedEvent, options: PublishOptions): Promise<void>
}

// Every connection to a url reaches the same container, so one context observes another's writes.
export type RelayConnection = {
  onMessage(listener: (message: RelayMessage) => void): void
  send(message: ClientMessage): void
  close(): void
}

// A relay implementation the suite can run against. The protocol is the same on all of them, so this is the rest.
export type Backend = {
  readonly name: string
  // Puts the image on this machine, once per worker.
  prepare(): Promise<void>
  // Replaces any running container with an empty one, and returns once it can be configured.
  up(): Promise<void>
  down(): Promise<void>
  logs(): Promise<string>
  // For policy a backend can only grant one member at a time, called once a join is accepted.
  admit?(name: TenantName, user: TestUser): Promise<void>
}
