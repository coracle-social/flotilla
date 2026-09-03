import type {BrowserContext} from "@playwright/test"

// What `getInfo` answers with. `supports` is what src/app/components/WalletConnect.svelte gates the
// connection on, and the node's alias is what the wallet page names the connection by.
export type WebLnInfo = {
  supports?: string[]
  node?: {alias?: string; pubkey?: string}
  version?: string
}

/**
 * A WebLN provider on `window`, in the shape a browser extension installs. Connecting is a
 * capability handshake and nothing more, so the whole provider answers from a literal in the page —
 * paying an invoice and issuing one are past the boundary this harness stops at, and calling either
 * here throws rather than pretending.
 *
 * Install it before the page navigates. WalletConnect reads `window.webln` while it renders, to
 * decide whether to offer the button at all.
 */
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
