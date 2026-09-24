import type {BrowserContext} from "@playwright/test"
import {ms} from "@welshman/lib"
import type {TrustedEvent} from "@welshman/util"
import type {TestUser} from "../keys"
import {injectEvents, injectSession} from "./session"

// Must match TEST_ENV_KEY in src/lib/test/env.ts.
const TEST_ENV_KEY = "__TEST_ENV__"

// Set the first time the app reads the injected env, the only evidence here that src/app/env.ts ran.
const TEST_ENV_READ_KEY = "__TEST_ENV_READ__"

export type BootOptions = {
  // Every relay list the app reads at startup is pointed here, so it can only dial the scenario's.
  relays: string[]
  // What a pubkey's own lists are resolved from, defaulting to `relays`.
  indexers?: string[]
  spaces?: string[]
  user?: TestUser
  // What this user's client already has in local storage, e.g. their room list.
  events?: TrustedEvent[]
  path?: string
  // VITE_ values the scenario sets for itself. Anything named here has to be something the test owns.
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
        // Nothing serves this url, so a push bridge connection is reported as a leak.
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

  // The root layout renders nothing until its async setup resolves, and a rejected session renders the landing dialog.
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

  // src/app/env.ts reads every VITE_ value as it is imported, so by now the app has resolved them.
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
