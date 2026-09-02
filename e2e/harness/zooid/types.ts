import type {SignedEvent, StampedEvent} from "@welshman/util"
import type {ClientMessage, RelayMessage} from "@welshman/net"
import type {TestUser} from "../keys"

export type PublishOptions = {
  // Which identity the seeding connection authenticates as. Defaults to the event's own author,
  // which then has to be a test identity. A gift wrap is signed by an ephemeral key nothing in this
  // process can authenticate as, so its connection belongs to the sender instead.
  as?: TestUser
}

export type RoomOptions = {
  name?: string
  about?: string
  picture?: string
  closed?: boolean
  private?: boolean
}

// A handle to one relay, plus the seeding affordances scenarios build on. Every seeding call
// publishes over a real socket rather than inserting into storage, so the relay stores exactly what
// it would have stored for a real client.
export type TestRelay = {
  readonly name: string
  readonly url: string
  room(h: string, options: RoomOptions, createdAt: number): Promise<void>
  message(user: TestUser, h: string, content: string, createdAt: number): Promise<SignedEvent>
  // Grants relay membership, and room membership too when `h` is given.
  member(user: TestUser, h: string | undefined, createdAt: number): Promise<void>
  // Escape hatch for kinds with no affordance of their own: profiles, reactions, threads, DMs.
  event(user: TestUser, event: StampedEvent): Promise<SignedEvent>
  // An event this process did not sign, sent over `as`'s connection. A gift wrap, whose author is
  // the ephemeral key that wrapped it, is the case that needs this.
  publish(event: SignedEvent, options: PublishOptions): Promise<void>
}

// One client's connection to a relay. Every connection to a url reaches the same container, so one
// browser context observes another's writes over the wire.
export type RelayConnection = {
  onMessage(listener: (message: RelayMessage) => void): void
  send(message: ClientMessage): void
  close(): void
}
