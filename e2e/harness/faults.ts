import {inspect} from "node:util"
import type {BrowserContext, ConsoleMessage} from "@playwright/test"

// A CSP refusal reaches the console and nothing else, so a policy that has rotted past the script
// it names is invisible to every spec: app.html's requestIdleCallback shim was refused on every
// platform for a week with the suite green (#535).
const isRefusal = (text: string) => text.includes("Content Security Policy")

// Every test recreates the zooid container, chromium aborts what the page had in flight when the
// interfaces churn, and sveltekit reports a route chunk lost that way as an uncaught TypeError. It
// reaches nearly every spec — 256 of the 258 faults a full survey run raised — so it stays in the
// log and out of the fault set until #529 stops the churn.
const isChunkLoss = (text: string) => text.includes("Failed to fetch dynamically imported module")

// Chrome reports a failed request as "Failed to load resource: the server responded with a status
// of 404 (Not Found)" and carries the url nowhere but the message's location, so a line built from
// the text alone cannot say which resource went missing.
const locate = (message: ConsoleMessage) => {
  const text = message.text()
  const {url} = message.location()

  return url && !text.includes(url) ? `${text} ${url}` : text
}

// Playwright builds this from the page's exception details, and a page that throws something other
// than an Error leaves it with neither message nor stack — which is how a fault used to reach the
// console log as a bare "uncaught:".
const describe = (error: Error) => error.stack || error.message || inspect(error)

export type FaultWatch = {
  // Everything either side said, for the account attached to a failing test.
  log: string[]
  // The subset of it that means the app broke rather than the box being noisy.
  found: string[]
  observe(context: BrowserContext, who: string): void
  // Throws when the app itself broke while the test ran: an uncaught exception, or code of ours the
  // browser refused to run. A failed request or a noisy warning is neither — a dev server is full
  // of both — so those stay in the log.
  assertNone(): void
}

export const watchFaults = (): FaultWatch => {
  const log: string[] = []
  const found: string[] = []

  const record = (line: string, fault: boolean) => {
    log.push(line)

    if (fault) found.push(line)
  }

  return {
    log,
    found,
    observe(context, who) {
      context.on("console", message => {
        const type = message.type()
        const text = locate(message)

        if (["error", "warning"].includes(type)) {
          record(`[${who}] ${type}: ${text}`, type === "error" && isRefusal(text))
        }
      })

      context.on("weberror", error => {
        const text = describe(error.error())

        record(`[${who}] uncaught: ${text}`, !isChunkLoss(text))
      })
    },
    assertNone() {
      if (found.length > 0) {
        throw new Error(
          [
            "The app broke while the test ran, so nothing it asserted means anything:",
            ...found.map(fault => `  ${fault}`),
          ].join("\n"),
        )
      }
    },
  }
}
