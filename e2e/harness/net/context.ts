import type {BrowserContext} from "@playwright/test"

// State the harness keeps per browser context, outside the browser: recorded traffic, blocked
// requests, the hosting fake's store. Reading one before the route installer that owns it has run
// is a spec calling things out of order, which the error names.
export const makeContextStore = <T>(installer: string) => {
  const byContext = new WeakMap<BrowserContext, T>()

  return {
    set: (context: BrowserContext, value: T) => {
      byContext.set(context, value)

      return value
    },
    get: (context: BrowserContext) => {
      const value = byContext.get(context)

      if (value) return value

      throw new Error(`${installer} was never called for this browser context`)
    },
  }
}
