import type {Maybe} from "@welshman/lib"

// The window key Playwright writes to, duplicated in e2e/harness/app/boot.ts.
export const TEST_ENV_KEY = "__TEST_ENV__"

// Points each browser context at the relays its own test created, and yields nothing otherwise.
export const maybeGetTestEnv = (key: string): Maybe<string> =>
  (globalThis as {[TEST_ENV_KEY]?: Record<string, string>})[TEST_ENV_KEY]?.[key]
