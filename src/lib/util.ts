import {tryCatch, hexToBytes, bytesToHex} from "@welshman/lib"
import {COMMENT, DIRECT_MESSAGE, DIRECT_MESSAGE_FILE, fromNostrURI, Pubkey} from "@welshman/util"
import type {Filter} from "@welshman/util"
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

export const formatDuration = (seconds: number) => {
  const whole = Math.floor(seconds)

  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`
}

export const formatBytes = (bytes: number) => {
  const units = ["byte", "kilobyte", "megabyte", "gigabyte"]
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1000)), units.length - 1)
  const format = new Intl.NumberFormat(undefined, {
    style: "unit",
    unit: units[i],
    unitDisplay: "narrow",
    maximumFractionDigits: 1,
  })

  return format.format(bytes / 1000 ** i)
}

export const makeCommentFilter = (kinds: number[], extra: Filter = {}) => ({
  kinds: [COMMENT],
  "#K": kinds.map(String),
  ...extra,
})

export const DM_KINDS = [DIRECT_MESSAGE, DIRECT_MESSAGE_FILE]
