import {verifyEvent} from "nostr-tools/pure"

// Welshman's optional accelerator expects verification to throw on invalid events.
export const initNostrWasm = async () => ({
  verifyEvent(event) {
    if (!verifyEvent(event)) {
      throw new Error("Invalid Nostr event")
    }
  },
})
