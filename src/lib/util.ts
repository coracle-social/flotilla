import {identity, range, DAY, hexToBytes, bytesToHex} from "@welshman/lib"
import {fromNostrURI} from "@welshman/util"
import * as nip19 from "nostr-tools/nip19"

export const decodePubkey = (entity: string): string | undefined => {
  if (/^[a-f0-9]{64}$/i.test(entity)) {
    return entity.toLowerCase()
  }

  try {
    const decoded = nip19.decode(fromNostrURI(entity))

    if (decoded.type === "npub") {
      return decoded.data
    }

    if (decoded.type === "nprofile") {
      return decoded.data.pubkey
    }

    return undefined
  } catch {
    return undefined
  }
}

export const nsecEncode = (secret: string) => nip19.nsecEncode(hexToBytes(secret))

export const nsecDecode = (nsec: string) => {
  const {type, data} = nip19.decode(nsec)

  if (type !== "nsec") {
    throw new Error(`Invalid nsec: ${nsec}`)
  }

  return bytesToHex(data)
}

export const day = (seconds: number) => Math.floor(seconds / DAY)

export const daysBetween = (start: number, end: number) => [...range(start, end, DAY)].map(day)

export const ucFirst = (s: string) => s.slice(0, 1).toUpperCase() + s.slice(1)

export const errorMessage = (err: unknown) => String(err).replace(/^.*Error: /, "")

export const buildUrl = (base: string | URL, ...pathname: string[]) => {
  const url = new URL(base)

  url.pathname = "/" + pathname.join("/")

  return url.toString()
}

export const addPeriod = (s: string) => (s + ".").replace(/\.+$/, ".")

export const normalizeTopic = (topic: string) => topic.trim().replace(/^#+/, "").toLowerCase()

export const fromCsv = (s: string) => (s || "").split(",").filter(identity)

export const stripPrefix = (m: string) => m.replace(/^\w+: /, "")
