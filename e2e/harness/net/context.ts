import type {BrowserContext} from "@playwright/test"

// Reading one before the route installer that owns it has run is a spec calling things out of order.
export const makeContextStore = <T>(installer: string) => {
  const byContext = new WeakMap<BrowserContext, T>()

  return {
    set: (context: BrowserContext, value: T) => {
      byContext.set(context, value)

      return value
    },
    get: (context: BrowserContext) => {
      const value = byContext.get(context)

      if (value) {
        return value
      }

      throw new Error(`${installer} was never called for this browser context`)
    },
  }
}
