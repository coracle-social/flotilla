import {decryptFile, matchTags, tagSpec, tagValue} from "@welshman/util"
import type {TrustedEvent} from "@welshman/util"

export const IMAGE_CONTENT_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"]

export const VIDEO_CONTENT_TYPES = ["video/quicktime", "video/webm", "video/mp4"]

export const AUDIO_CONTENT_TYPES = [
  "audio/mpeg",
  "audio/mp4",
  "audio/wav",
  "audio/x-wav",
  "audio/ogg",
  "audio/webm",
  "audio/flac",
]

export const getUrlTags = (url: string, event: TrustedEvent) => {
  // An imeta entry is "key value" and the value may contain spaces, so split at the first one only.
  const imetas = matchTags(tagSpec("imeta"), event.tags).map(([, ...values]: string[]) =>
    values.map(value => value.split(/ (.*)/s, 2)),
  )
  const imeta = imetas.find(meta => tagValue(tagSpec("url"), meta) === url)

  if (imeta) {
    return imeta
  }

  // An event carrying imeta has said all it has to say about each url.
  return imetas.length > 0 ? [] : event.tags
}

export const getUrlContentType = (url: string, event: TrustedEvent) => {
  const tags = getUrlTags(url, event)

  return tagValue(tagSpec("m"), tags) || tagValue(tagSpec("file-type"), tags) || ""
}

export const isImageUrl = (url: string, event: TrustedEvent) =>
  Boolean(url.match(/\.(jpe?g|png|gif|webp)$/)) ||
  IMAGE_CONTENT_TYPES.includes(getUrlContentType(url, event))

export const decryptUrl = async (url: string, event: TrustedEvent, signal?: AbortSignal) => {
  const tags = getUrlTags(url, event)
  const algorithm = tagValue(tagSpec("encryption-algorithm"), tags)
  const key = tagValue(tagSpec("decryption-key"), tags)
  const nonce = tagValue(tagSpec("decryption-nonce"), tags)

  if (algorithm === "aes-gcm" && key && nonce) {
    const response = await fetch(url, {signal})
    if (!response.ok) {
      throw new Error(`Attachment download failed (HTTP ${response.status}).`)
    }
    const ciphertext = new Uint8Array(await response.arrayBuffer())
    const data = await decryptFile({ciphertext, key, nonce, algorithm})
    signal?.throwIfAborted()
    return URL.createObjectURL(
      new Blob([new Uint8Array(data)], {type: getUrlContentType(url, event)}),
    )
  }

  return url
}
