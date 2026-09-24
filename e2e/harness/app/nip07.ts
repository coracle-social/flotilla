import type {BrowserContext} from "@playwright/test"
import type {StampedEvent} from "@welshman/util"
import type {TestUser} from "../keys"

// The keys live in node, so a signer built in the page would not be the one seeding signs with.
const TEST_NIP07_KEY = "__TEST_NIP07__"

type Nip07Call =
  | {method: "getPublicKey"}
  | {method: "signEvent"; template: StampedEvent}
  | {method: "encrypt" | "decrypt"; scheme: "nip04" | "nip44"; pubkey: string; message: string}

/** A NIP-07 provider backed by a test identity's real signer, installed before the page navigates. */
export const injectNip07 = async (context: BrowserContext, user: TestUser) => {
  await context.exposeBinding(TEST_NIP07_KEY, (source, call: Nip07Call) => {
    if (call.method === "getPublicKey") {
      return user.pubkey
    }

    if (call.method === "signEvent") {
      return user.signer.sign(call.template)
    }

    const {encrypt, decrypt} = call.scheme === "nip04" ? user.signer.nip04 : user.signer.nip44

    return call.method === "encrypt"
      ? encrypt(call.pubkey, call.message)
      : decrypt(call.pubkey, call.message)
  })

  await context.addInitScript(key => {
    const call = (request: Nip07Call) => Reflect.get(window, key)(request)

    Object.assign(window, {
      nostr: {
        getPublicKey: () => call({method: "getPublicKey"}),
        signEvent: (template: StampedEvent) => call({method: "signEvent", template}),
        nip04: {
          encrypt: (pubkey: string, message: string) =>
            call({method: "encrypt", scheme: "nip04", pubkey, message}),
          decrypt: (pubkey: string, message: string) =>
            call({method: "decrypt", scheme: "nip04", pubkey, message}),
        },
        nip44: {
          encrypt: (pubkey: string, message: string) =>
            call({method: "encrypt", scheme: "nip44", pubkey, message}),
          decrypt: (pubkey: string, message: string) =>
            call({method: "decrypt", scheme: "nip44", pubkey, message}),
        },
      },
    })
  }, TEST_NIP07_KEY)
}
