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
import {
  assertNoLeaks,
  formatTranscript,
  installWebSocketRoutes,
  silenceRelay,
} from "./net/websocket"
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
  silenceRelay,
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
  mockOpenRouterTranscription,
} from "./net/http"
export type {
  DufflepudFixtures,
  HostingFixtures,
  HostingHandle,
  HostingRecord,
  Transcription,
} from "./net/http"
export type {WebLnInfo} from "./app/webln"

// Mirrors encodeRelay in src/app/relays.ts, which cannot be imported without pulling in sveltekit.
const encodeRelay = (url: string) =>
  encodeURIComponent(
    normalizeRelayUrl(url)
      .replace(/^wss:\/\//, "")
      .replace(/\/$/, ""),
  )

export const spacePath = (url: string) => `/spaces/${encodeRelay(url)}`

export const roomPath = (url: string, h: string) => `${spacePath(url)}/${h}`

// Mirrors makeChatId in src/app/chats.ts.
export const chatPath = (...pubkeys: string[]) => `/chat/${[...pubkeys].sort().join(",")}`

export const profilePath = (pubkey: string) => `/people/${npubEncode(pubkey)}`

// Matches a path literally, for one whose query string, hash or dots would otherwise be wildcards.
export const pathPattern = (path: string) => new RegExp(path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))

// What a page is opened with, over and above the scenario's own relays.
export type PageOptions = {
  // Overrides the project's context options, for a spec needing its own viewport or permission.
  context?: BrowserContextOptions
  // VITE_ values applied over the ones derived from the scenario's relays. See BootOptions in app/boot.ts.
  env?: Record<string, string>
  // A NIP-07 provider signing as this user, for a login that goes through an extension.
  nip07?: TestUser
  // A WebLN provider on window, for a wallet that gets connected through an extension.
  webln?: WebLnInfo
  // A blossom server installed before boot, for a url src/app/sync.ts probes and caches on load.
  blossom?: BlossomOptions
  // Fields merged over a relay's own nip-11 document, keyed by relay url.
  relayInfo?: RelayInfoOverrides
  // What the hosting backend already knows about this user; getHosting changes it mid-test.
  hosting?: HostingFixtures
  // Relay urls that take the socket and answer nothing; silenceRelay does the same mid-test.
  silent?: string[]
}

export type Harness = {
  zooid: Zooid
  seed(build: (tools: SeedTools) => MaybeAsync<void>): Promise<Scenario>
  // A logged-in page for a user, in its own browser context.
  as(user: TestUser, path?: string, options?: PageOptions): Promise<Page>
  // The same page with no session injected, which is the only way to watch a login or a logout.
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
  // Playwright's own context is unrouted, so a page born there boots against the relays in .env.
  context: async () => {
    throw new Error(
      "The built-in `context` and `page` fixtures reach the real network. Open a page with the " +
        "harness's `as(user, path)` or `visit(path)` fixture, which install interception before " +
        "they navigate.",
    )
  },
  // Playwright builds this with request.newContext(), which belongs to no browser context.
  request: async () => {
    throw new Error(
      "The built-in `request` fixture makes http requests from node, where nothing intercepts " +
        "them. Anything the app fetches belongs in a mock installed by `as(user, path)`.",
    )
  },
  // One container per worker, recreated in the teardown of the test that finishes.
  zooid: [
    // playwright reads a fixture's dependencies off this pattern, so it stays a pattern.
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
    await zooid.ensure()

    const contexts: {name: string; context: BrowserContext}[] = []
    const faults = watchFaults()

    let scenario: Maybe<Scenario>

    const requireScenario = () => {
      if (scenario) {
        return scenario
      }

      throw new Error("Seed a scenario before opening a page for a user")
    }

    const open = async (path: string, options: PageOptions, user?: TestUser) => {
      const {urls, indexerUrls, cache} = requireScenario()

      await zooid.settle()
      // context.route does not see a request a service worker makes, and sveltekit registers one in dev.
      const context = await browser.newContext({
        ...testInfo.project.use,
        serviceWorkers: "block",
        ...options.context,
      })

      contexts.push({name: user?.name ?? "anonymous", context})

      // use.trace and the built-in reporting only cover contexts playwright made itself.
      faults.observe(context, user?.name ?? "anonymous")

      // Playwright matches the most recently registered route first, so the block-all goes in first.
      await installHttpRoutes(context)
      await installWebSocketRoutes(context, zooid)

      for (const url of options.silent ?? []) {
        silenceRelay(context, url)
      }

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

      // Headless Chromium reports Notification.permission as "denied" whatever playwright granted.
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

    // Closed before anything is read off it: an $effect teardown reading a cleared binding throws.
    for (const {context} of contexts) {
      await context.close()
    }

    // Before the assertions below, which throw: a failing test still owes the next one a container.
    await zooid.reset()

    if (faults.found.length > 0 || testInfo.status !== testInfo.expectedStatus) {
      // A path rather than a body, since the list reporter truncates an inline attachment.
      const consolePath = testInfo.outputPath("browser-console.log")

      await writeFile(consolePath, faults.log.join("\n"))
      await testInfo.attach("browser-console", {path: consolePath, contentType: "text/plain"})

      // Whether a user ever had an event, which tells a client that dropped one from a relay that never sent it.
      const transcriptPath = testInfo.outputPath("relay-transcript.log")

      await writeFile(
        transcriptPath,
        contexts.map(({name, context}) => `== ${name}\n${formatTranscript(context)}`).join("\n"),
      )
      await testInfo.attach("relay-transcript", {
        path: transcriptPath,
        contentType: "text/plain",
      })
    }

    faults.assertNone()

    for (const {context} of contexts) {
      assertNoLeaks(context)
    }
  },
  seed: async ({harness}, use) => use(harness.seed),
  as: async ({harness}, use) => use(harness.as),
  visit: async ({harness}, use) => use(harness.visit),
})
