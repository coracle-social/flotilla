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

export class AbortError extends Error {
  constructor() {
    super("Aborted")
    this.name = "AbortError"
  }
}

export class TimeoutError extends Error {
  constructor(message = "Timed out") {
    super(message)
    this.name = "TimeoutError"
  }
}

/** Returns a promise that rejects with AbortError when signal aborts. Use with Promise.race. */
export const whenAborted = (signal?: AbortSignal) => {
  if (!signal) {
    return new Promise<never>(() => {})
  }

  return new Promise<never>((_, reject) => {
    const onAborted = () => reject(new AbortError())
    if (signal.aborted) {
      onAborted()
    } else {
      signal.addEventListener("abort", onAborted, {once: true})
    }
  })
}

/**
 * Returns a promise that rejects with TimeoutError after ms. Use with Promise.race.
 * Pass an optional signal to clear the timer when that signal aborts (self-cleaning).
 */
export const whenTimeout = (ms: number, opts: {message?: string; signal?: AbortSignal} = {}) => {
  return new Promise<never>((_, reject) => {
    const timeout = setTimeout(() => reject(new TimeoutError(opts.message)), ms)
    opts.signal?.addEventListener("abort", () => clearTimeout(timeout), {once: true})
  })
}

export const buildUrl = (base: string | URL, ...pathname: string[]) => {
  const url = new URL(base)

  url.pathname = "/" + pathname.join("/")

  return url.toString()
}

export const addPeriod = (s: string) => (s + ".").replace(/\.+$/, ".")

export const normalizeTopic = (topic: string) => topic.trim().replace(/^#+/, "").toLowerCase()

export const fromCsv = (s: string) => (s || "").split(",").filter(identity)

export const stripPrefix = (m: string) => m.replace(/^\w+: /, "")
