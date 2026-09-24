import type {BrowserContext} from "@playwright/test"
import type {TrustedEvent} from "@welshman/util"
import type {TestUser} from "../keys"

// Must match TEST_SESSION_KEY and TEST_EVENTS_KEY in src/lib/test/session.ts.
const TEST_SESSION_KEY = "__TEST_SESSION__"

const TEST_EVENTS_KEY = "__TEST_EVENTS__"

// The {method, data} shape @welshman/app's session handlers deserialize, installed before navigating.
export const injectSession = (context: BrowserContext, user: TestUser) =>
  context.addInitScript(
    ([key, session]) => {
      Object.assign(window, {[key]: session})
    },
    [TEST_SESSION_KEY, {method: "nip01", data: {secret: user.secret}}] as const,
  )

// The local cache a returning user would boot with, loaded once the injected session is restored.
export const injectEvents = (context: BrowserContext, events: TrustedEvent[]) =>
  context.addInitScript(
    ([key, value]) => {
      Object.assign(window, {[key]: value})
    },
    [TEST_EVENTS_KEY, events] as const,
  )
