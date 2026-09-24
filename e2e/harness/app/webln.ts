import type {BrowserContext} from "@playwright/test"

// `supports` is what WalletConnect.svelte gates the connection on, and the alias names it on screen.
export type WebLnInfo = {
  supports?: string[]
  node?: {alias?: string; pubkey?: string}
  version?: string
}

/** A WebLN provider on `window`, installed before the page navigates: WalletConnect reads it while it renders. */
export const injectWebLn = (context: BrowserContext, info: WebLnInfo = {}) =>
  context.addInitScript(
    $info => {
      Object.assign(window, {
        webln: {
          enable: () => Promise.resolve(),
          getInfo: () => Promise.resolve($info),
          getBalance: () => Promise.resolve({balance: 0}),
        },
      })
    },
    {supports: ["lightning"], ...info},
  )
