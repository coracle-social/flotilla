import {writeFile} from "node:fs/promises"
import {npubEncode} from "nostr-tools/nip19"
import {test as base, expect} from "@playwright/test"
import type {BrowserContext, BrowserContextOptions, Page} from "@playwright/test"
import type {Maybe, MaybeAsync} from "@welshman/lib"
import {normalizeRelayUrl} from "@welshman/util"
import {Zooid, describeDockerProblem} from "./zooid/relay"
import {
  installHttpRoutes,
  mockAnalytics,
  mockBlossom,
  mockDufflepud,
  mockHosting,
  mockImages,
  mockPushServer,
  mockRelayInfo,
} from "./net/http"
import type {BlossomOptions, HostingFixtures, RelayInfoOverrides} from "./net/http"
import {assertNoLeaks, installWebSocketRoutes} from "./net/websocket"
import {watchFaults} from "./faults"
import {boot} from "./app/boot"
import {injectNip07} from "./app/nip07"
import {injectWebLn} from "./app/webln"
import {seed} from "./seed/scenario"
import type {Scenario, SeedTools} from "./seed/scenario"
import type {TestUser} from "./keys"
import type {WebLnInfo} from "./app/webln"

export {expect}
export {makeTestUser, users} from "./keys"
export type {TestUser} from "./keys"
export type {Scenario} from "./seed/scenario"
export type {SeededEvent} from "./seed/publish"
export type {SeededOpenRelay} from "./seed/openRelay"
export type {SeededRumor, SeededSpace} from "./seed/space"
export type {OpenRelayName, SpaceName, TenantName} from "./zooid/config"
export type {PublishedEvent, TranscriptEntry} from "./net/websocket"
export {
  forgetRelay,
  formatTranscript,
  getPublished,
  getPublishedEvents,
  getTranscript,
} from "./net/websocket"
export {readCachedEvents} from "./app/cache"
export {
  bubble,
  chatItems,
  chatList,
  composer,
  composerDisabled,
  composerEnabled,
  dialog,
  emojiButton,
  longDate,
  menuButton,
  message,
  messageActions,
  messages,
  modalForm,
  noteEditor,
  openMessageMenu,
  openRoomDetail,
  pageBar,
  pickEmoji,
  roomLink,
  send,
  sendButton,
  settingRow,
  settingToggle,
  timeline,
  toast,
  topDialog,
} from "./ui"
export {GIF, GIF_BASE64, WEBP, chooseFile, gifFile} from "./files"
export type {TestFile} from "./files"
export {
  DEFAULT_BLOSSOM_ORIGIN,
  assertNoBlockedRequests,
  getHosting,
  mockBlossom,
  mockDufflepud,
  mockLivekit,
  mockOpenRouterSpeech,
} from "./net/http"
export type {DufflepudFixtures, HostingFixtures, HostingHandle, HostingRecord} from "./net/http"
export type {WebLnInfo} from "./app/webln"

// Mirrors encodeRelay in src/app/relays.ts. Importing it reaches the app's module graph, and with
// it sveltekit.
const encodeRelay = (url: string) =>
  encodeURIComponent(
    normalizeRelayUrl(url)
      .replace(/^wss:\/\//, "")
      .replace(/\/$/, ""),
  )

export const spacePath = (url: string) => `/spaces/${encodeRelay(url)}`

export const roomPath = (url: string, h: string) => `${spacePath(url)}/${h}`

// The path the app builds for a conversation: the other participants' pubkeys, sorted and joined
// with commas — see makeChatId in src/app/chats.ts.
export const chatPath = (...pubkeys: string[]) => `/chat/${[...pubkeys].sort().join(",")}`

export const profilePath = (pubkey: string) => `/people/${npubEncode(pubkey)}`

// A literal as a pattern, for a url that carries a query string or a modal's hash alongside the
// path being matched, or a host whose dots would otherwise be wildcards.
export const pathPattern = (path: string) => new RegExp(path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))

// What a page is opened with, over and above the scenario's own relays.
export type PageOptions = {
  // Overrides the project's context options, for a spec that needs a viewport or a permission of
  // its own.
  context?: BrowserContextOptions
  // VITE_ values applied over the ones derived from the scenario's relays, e.g. a platform space or
  // the domain hosted relays are created under. See BootOptions in app/boot.ts.
  env?: Record<string, string>
  // A NIP-07 provider signing as this user, for a login that goes through an extension.
  nip07?: TestUser
  // A WebLN provider on window, for a wallet that gets connected through an extension.
  webln?: WebLnInfo
  // A blossom server, installed before the page boots. mockBlossom called on the page `as()`
  // returns arrives after src/app/sync.ts has probed and cached a space's own url, so a spec whose
  // server is one the app probes on load has to name it here instead.
  blossom?: BlossomOptions
  // Fields merged over a relay's own nip-11 document, keyed by relay url.
  relayInfo?: RelayInfoOverrides
  // What the hosting backend already knows about this user. Read `getHosting(page.context())` for
  // the handle that changes it mid-test.
  hosting?: HostingFixtures
}

export type Harness = {
  zooid: Zooid
  seed(build: (tools: SeedTools) => MaybeAsync<void>): Promise<Scenario>
  // A logged-in page for a user, in its own browser context, with its own storage and its own
  // sockets into the relays every other user is talking to.
  as(user: TestUser, path?: string, options?: PageOptions): Promise<Page>
  // The same page with no session injected, which is the only way to watch a login or a logout
  // happen.
  visit(path?: string, options?: PageOptions): Promise<Page>
}

export type HarnessFixtures = {
  harness: Harness
  seed: Harness["seed"]
  as: Harness["as"]
  visit: Harness["visit"]
}

export type HarnessWorkerFixtures = {
  zooid: Zooid
}

export const test = base.extend<HarnessFixtures, HarnessWorkerFixtures>({
  // Playwright's own context, and the `page` fixture built on it, is unrouted, so a page born
  // there boots the app against the relays baked into .env.
  context: async () => {
    throw new Error(
      "The built-in `context` and `page` fixtures reach the real network. Open a page with the " +
        "harness's `as(user, path)` or `visit(path)` fixture, which install interception before " +
        "they navigate.",
    )
  },
  // Playwright builds this one with `playwright.request.newContext()`, an http client in this
  // process that belongs to no browser context, so `installHttpRoutes` cannot see it.
  request: async () => {
    throw new Error(
      "The built-in `request` fixture makes http requests from node, where nothing intercepts " +
        "them. Anything the app fetches belongs in a mock installed by `as(user, path)`.",
    )
  },
  // One container per worker, torn down when the worker ends. It is reset between tests rather
  // than recreated, so the docker start-up cost is paid once.
  zooid: [
    // playwright reads a fixture's dependencies off this pattern, so it has to stay a pattern
    // even when there are none.
    // eslint-disable-next-line no-empty-pattern
    async ({}, use) => {
      const zooid = new Zooid()

      await use(zooid)
      await zooid.stop()
    },
    {scope: "worker"},
  ],
  harness: async ({zooid, browser}, use, testInfo) => {
    const dockerProblem = await describeDockerProblem()

    testInfo.skip(Boolean(dockerProblem), dockerProblem)

    await zooid.start()
    await zooid.reset()

    const contexts: BrowserContext[] = []
    const faults = watchFaults()

    let scenario: Maybe<Scenario>

    const requireScenario = () => {
      if (scenario) return scenario

      throw new Error("Seed a scenario before opening a page for a user")
    }

    const open = async (path: string, options: PageOptions, user?: TestUser) => {
      const {urls, indexerUrls, cache} = requireScenario()
      // The project's own `use` first, so a viewport or device descriptor set in
      // playwright.config.ts reaches the context rather than being dropped.
      //
      // context.route does not see a request a service worker makes, and sveltekit registers
      // src/service-worker.js on every navigation in dev, so registration is blocked rather than
      // left as the thing containment rests on.
      const context = await browser.newContext({
        ...testInfo.project.use,
        serviceWorkers: "block",
        ...options.context,
      })

      contexts.push(context)

      // `use.trace` and the built-in reporting only cover contexts playwright made itself, so a
      // failure in a context opened here arrives with the app's own account of it thrown away —
      // which is how a spec that caught the app on its 500 page had nothing to say about why.
      faults.observe(context, user?.name ?? "anonymous")

      // Playwright matches the most recently registered route first and every mock falls through
      // what it doesn't recognize, so the block-all goes in before the mocks, and all of it before
      // the page navigates.
      await installHttpRoutes(context)
      await installWebSocketRoutes(context, zooid)
      await mockRelayInfo(context, options.relayInfo ?? {})
      await mockAnalytics(context)
      await mockDufflepud(context)
      await mockHosting(context, options.hosting)
      await mockPushServer(context)
      await mockImages(context)

      if (options.blossom) {
        await mockBlossom(context, options.blossom)
      }

      if (options.nip07) {
        await injectNip07(context, options.nip07)
      }

      if (options.webln) {
        await injectWebLn(context, options.webln)
      }

      // Headless Chromium reports `Notification.permission` as "denied" even where playwright has
      // granted the permission at the browser level, so the grant is reflected into the API the app
      // reads.
      if (options.context?.permissions?.includes("notifications")) {
        await context.addInitScript(() => {
          Object.defineProperty(Notification, "permission", {
            configurable: true,
            get: () => "granted",
          })
          Notification.requestPermission = () => Promise.resolve("granted")
        })
      }

      return boot(context, {
        user,
        path,
        env: options.env,
        relays: urls,
        indexers: indexerUrls,
        spaces: urls,
        events: user ? cache(user) : [],
      })
    }

    await use({
      zooid,
      as: (user, path = "/", options = {}) => open(path, options, user),
      visit: (path = "/", options = {}) => open(path, options),
      seed: async build => {
        scenario = await seed(zooid, build)

        return scenario
      },
    })

    // Closed before anything is read off it: an $effect teardown reading a binding svelte has
    // already cleared throws on unmount, and that is the fault the suite was blindest to.
    for (const context of contexts) {
      await context.close()
    }

    if (faults.found.length > 0 || testInfo.status !== testInfo.expectedStatus) {
      // A path rather than a body: the list reporter truncates an inline attachment, and the
      // nightly run on the box keeps test-results and nothing else.
      const path = testInfo.outputPath("browser-console.log")

      await writeFile(path, faults.log.join("\n"))
      await testInfo.attach("browser-console", {path, contentType: "text/plain"})
    }

    faults.assertNone()

    for (const context of contexts) {
      assertNoLeaks(context)
    }
  },
  seed: async ({harness}, use) => use(harness.seed),
  as: async ({harness}, use) => use(harness.as),
  visit: async ({harness}, use) => use(harness.visit),
})
