import {sum} from "@welshman/lib"
import type {SttFile} from "./types"

const engineRevision = "93e88ede867e4311c39151285e74df513e4b835b"

const weightsRevision = "ca5287601bef25af26dcf2e1b2bdc0843a7c19e5"

/**
 * Whistle and the wasm engine that runs it, both Apache-2.0 and both from Cactus Compute. The
 * engine is a 929 KB single-threaded build needing no SharedArrayBuffer, so it runs in a phone's
 * web view. Each is pinned to a revision, so an upstream change never lands under a cached download.
 */
export const sttFiles: Record<"script" | "wasm" | "weights", SttFile> = {
  script: {
    url: `https://huggingface.co/Cactus-Compute/needle3/resolve/${engineRevision}/wasm/needle.js`,
    bytes: 63072,
  },
  wasm: {
    url: `https://huggingface.co/Cactus-Compute/needle3/resolve/${engineRevision}/wasm/needle.wasm`,
    bytes: 929343,
  },
  weights: {
    url: `https://huggingface.co/Cactus-Compute/whistle/resolve/${weightsRevision}/whistle.cact`,
    bytes: 16919407,
  },
}

export const sttModel = {
  sampleRate: 16000,
  languages: "English, German, French, Spanish, Italian, Dutch and Polish",
} as const

// Users' downloaded models live under this name, so naming the revisions is what replaces one.
const sttCacheName = `local-speech-${engineRevision}-${weightsRevision}`

export const sttModelBytes = sum(Object.values(sttFiles).map(({bytes}) => bytes))

// Opens this model's cache and drops any other, so a replaced model gives its space back.
export const openSttCache = async () => {
  for (const name of await caches.keys()) {
    if (name.startsWith("local-speech-") && name !== sttCacheName) {
      await caches.delete(name)
    }
  }

  return caches.open(sttCacheName)
}

export const removeSttCache = () => caches.delete(sttCacheName)

// What a download has left to fetch, so its progress can be one number rather than each file's own.
export const missingSttBytes = async () => {
  const cache = await openSttCache()
  const sizes = await Promise.all(
    Object.values(sttFiles).map(async ({url, bytes}) => ((await cache.match(url)) ? 0 : bytes)),
  )

  return sum(sizes)
}

export const hasSttModel = async () => (await missingSttBytes()) === 0
