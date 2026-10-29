import type {Maybe} from "@welshman/lib"
import type {TrustedEvent} from "@welshman/util"
import type {Repository} from "@welshman/store"
import type {Session} from "@welshman/app"

// The window keys Playwright writes to, duplicated in e2e/harness/app/session.ts.
export const TEST_SESSION_KEY = "__TEST_SESSION__"

export const TEST_EVENTS_KEY = "__TEST_EVENTS__"

// Yields a session only where Playwright injected one, and is stripped from production builds.
export const getTestSession = (): Maybe<Session> =>
  import.meta.env.DEV ? (globalThis as {[TEST_SESSION_KEY]?: Session})[TEST_SESSION_KEY] : undefined

// The events a returning user's client would have found in storage.
export const publishTestEvents = (repository: Repository) => {
  const events = (globalThis as {[TEST_EVENTS_KEY]?: TrustedEvent[]})[TEST_EVENTS_KEY] ?? []

  return Promise.all(events.map(event => repository.publish(event)))
}
