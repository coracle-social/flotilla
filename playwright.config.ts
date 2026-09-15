import {defineConfig, devices} from "@playwright/test"

// One engine per run rather than a project per engine: these specs exercise protocol behaviour —
// sockets, auth, sync — so a third copy of each buys much less than it costs. Run the whole suite
// under another engine with `E2E_BROWSER=webkit pnpm test`.
const deviceNames: Record<string, string> = {
  chromium: "Desktop Chrome",
  firefox: "Desktop Firefox",
  webkit: "Desktop Safari",
}

const browserName = process.env.E2E_BROWSER ?? "chromium"

const device = devices[deviceNames[browserName]]

// Dictation records from a microphone, and headless chromium has none. The fake device answers
// getUserMedia with a generated tone and the fake ui grants it without a prompt. Both are launch
// arguments rather than context options, so they belong to the whole run.
const launchOptions =
  browserName === "chromium"
    ? {args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"]}
    : {}

// vite.config.ts's port, and what the harness lets past its block-all. Overridable so a run can
// stand up its own dev server next to one that is already holding the default port.
const port = process.env.E2E_PORT ?? "1847"

export default defineConfig({
  testDir: "e2e/specs",
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // Fixture setup is charged to the test, and the harness fixture does a lot of it: the container
  // is recreated and waits for the relay to answer, seeding authenticates a socket per
  // identity, and the first test of a run also pays vite's on-demand compile of the whole
  // sveltekit graph. Playwright's 30s default kills that partway through as a flake.
  timeout: 120_000,
  // An assertion carries its own deadline, which the test's does not bound, and the first one in a
  // spec runs the moment the shell mounts: it waits out the socket opening, the nip-42 exchange,
  // the three negentropy pulls a space is synced with and a render. Playwright's 5s default is a
  // coin flip on a loaded machine.
  expect: {timeout: 30_000},
  // One container on a fixed port, so the suite can't be sharded.
  workers: 1,
  // list alongside html: the html report is where a failure is investigated, but a run that skips
  // has to say so on the terminal, where the person who started it is looking.
  reporter: [["list"], ["html"]],
  use: {
    baseURL: `http://localhost:${port}`,
    trace: "on-first-retry",
    launchOptions,
    // Granted for every context: the fake device is the only one there is, so nothing is reachable
    // through it that a spec has not asked for.
    permissions: ["microphone"],
  },
  // Boots the SvelteKit dev server before the suite and reuses one if already running locally. The
  // app resolves its VITE_ values against a key the harness injects per browser context, so any
  // dev server will do.
  webServer: {
    command: `pnpm dev --port ${port}`,
    url: `http://localhost:${port}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [{name: "zooid", use: {...device}}],
})
