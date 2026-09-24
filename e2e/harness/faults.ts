import {inspect} from "node:util"
import type {BrowserContext, ConsoleMessage} from "@playwright/test"

// A CSP refusal reaches the console and nothing else, so a policy that has rotted is invisible (#535).
const isRefusal = (text: string) => text.includes("Content Security Policy")

// Recreating the container between tests aborts route chunks in flight, until #529 stops the churn.
const isChunkLoss = (text: string) => text.includes("Failed to fetch dynamically imported module")

// Chrome carries a failed request's url nowhere but the message's location.
const locate = (message: ConsoleMessage) => {
  const text = message.text()
  const {url} = message.location()

  return url && !text.includes(url) ? `${text} ${url}` : text
}

// A page that throws something other than an Error leaves playwright neither message nor stack.
const describe = (error: Error) => error.stack || error.message || inspect(error)

export type FaultWatch = {
  // Everything either side said, for the account attached to a failing test.
  log: string[]
  // The subset of it that means the app broke rather than the box being noisy.
  found: string[]
  observe(context: BrowserContext, who: string): void
  // Throws on an uncaught exception or code the browser refused to run, not on a failed request.
  assertNone(): void
}

export const watchFaults = (): FaultWatch => {
  const log: string[] = []
  const found: string[] = []

  const record = (line: string, fault: boolean) => {
    log.push(line)

    if (fault) {
      found.push(line)
    }
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
