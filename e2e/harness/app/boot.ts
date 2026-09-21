import type {BrowserContext} from "@playwright/test"
import {ms} from "@welshman/lib"
import type {TrustedEvent} from "@welshman/util"
import type {TestUser} from "../keys"
import {injectEvents, injectSession} from "./session"

// Must match TEST_ENV_KEY in src/lib/test/env.ts.
const TEST_ENV_KEY = "__TEST_ENV__"

// Set the first time the app reads a value out of the injected env, the only evidence this side
// has that the hook in src/app/env.ts ran.
const TEST_ENV_READ_KEY = "__TEST_ENV_READ__"

export type BootOptions = {
  // Every relay list the app reads at startup is pointed here, so it can only dial relays the
  // scenario created.
  relays: string[]
  // What a pubkey's own lists are resolved from, which is a relay of its own only when the
  // scenario opened one. Defaults to `relays`.
  indexers?: string[]
  spaces?: string[]
  user?: TestUser
  // What this user's client already has in local storage, e.g. their room list.
  events?: TrustedEvent[]
  path?: string
  // VITE_ values the scenario sets for itself, applied over the relay-derived ones below. Anything
  // named here has to be something the test owns, or the test fails on a leak.
  env?: Record<string, string>
}

export const boot = async (
  context: BrowserContext,
  {relays, indexers = relays, spaces = [], user, events = [], path = "/", env = {}}: BootOptions,
) => {
  const urls = relays.join(",")

  await context.addInitScript(
    ([key, readKey, env]) => {
      Object.assign(window, {
        [key]: new Proxy(env, {
          get(target, prop) {
            Object.assign(window, {[readKey]: true})

            return Reflect.get(target, prop)
          },
        }),
      })
    },
    [
      TEST_ENV_KEY,
      TEST_ENV_READ_KEY,
      {
        VITE_DEFAULT_RELAYS: urls,
        VITE_INDEXER_RELAYS: indexers.join(","),
        VITE_DEFAULT_SEARCH_RELAYS: urls,
        VITE_DEFAULT_MESSAGING_RELAYS: urls,
        VITE_SIGNER_RELAYS: urls,
        VITE_DEFAULT_SPACES: spaces.join(","),
        VITE_PLATFORM_RELAYS: "",
        VITE_BLOCKED_RELAYS: "",
        // Nothing serves this url, so a push bridge connection is reported as a leak instead of
        // blending into the traffic of a relay the scenario did create.
        VITE_PUSH_BRIDGE: "ws://localhost:1/",
        ...env,
      },
    ] as const,
  )

  if (user) {
    await injectSession(context, user)
    await injectEvents(context, events)
  }

  const page = await context.newPage()

  await page.goto(path)

  // The root layout renders nothing until its async setup block resolves, so the shell appearing
  // is the first point at which the app is running. With a session injected, wait for the signed-in
  // nav instead. A session the app rejected renders the landing dialog, and failing on that here
  // reads far better than the assertions it would break later.
  const shell = page.locator(user ? ".primary-nav" : ".fl")

  for (let attempt = 0; ; attempt++) {
    try {
      await shell.waitFor({state: "attached", timeout: ms(15)})
      break
    } catch (e) {
      if (attempt === 3) {
        throw e
      }

      await page.reload()
    }
  }

  // src/app/env.ts reads every VITE_ value as it is imported, so by now the app has resolved them
  // against either the env above or .env's real relays.
  const usedTestEnv = await page.evaluate(
    key => Boolean(Reflect.get(window, key)),
    TEST_ENV_READ_KEY,
  )

  if (!usedTestEnv) {
    throw new Error(
      "The app read none of its VITE_ values from the harness, so it is pointed at the relays in " +
        ".env rather than at this scenario's. Check that src/app/env.ts still resolves them " +
        "through maybeGetTestEnv, and that the dev server is running in dev mode.",
    )
  }

  return page
}
