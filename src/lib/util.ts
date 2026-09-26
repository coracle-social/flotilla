import {tryCatch, hexToBytes, bytesToHex} from "@welshman/lib"
import {fromNostrURI, Pubkey} from "@welshman/util"
import * as nip19 from "nostr-tools/nip19"

export const decodePubkey = (entity: string) =>
  tryCatch(() => Pubkey.from(fromNostrURI(entity).toLowerCase()).pubkey)

export const nsecEncode = (secret: string) => nip19.nsecEncode(hexToBytes(secret))

export const nsecDecode = (nsec: string) => {
  const {type, data} = nip19.decode(nsec)

  if (type !== "nsec") {
    throw new Error(`Invalid nsec: ${nsec}`)
  }

  return bytesToHex(data)
}

export const ucFirst = (s: string) => s.slice(0, 1).toUpperCase() + s.slice(1)

export const errorMessage = (err: unknown) => String(err).replace(/^.*Error: /, "")

export const buildUrl = (base: string | URL, ...pathname: string[]) => {
  const url = new URL(base)

  url.pathname = "/" + pathname.join("/")

  return url.toString()
}

export const normalizeTopic = (topic: string) => topic.trim().replace(/^#+/, "").toLowerCase()

export const stripPrefix = (m: string) => m.replace(/^\w+: /, "")
