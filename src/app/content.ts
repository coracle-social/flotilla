import {
  CLASSIFIED,
  COMMENT,
  DELETE,
  DIRECT_MESSAGE,
  DIRECT_MESSAGE_FILE,
  EVENT_TIME,
  GENERIC_REPOST,
  PINBOARD,
  LONG_FORM,
  POLL,
  REACTION,
  REPORT,
  REPOST,
  THREAD,
  ZAP_GOAL,
  ZAP_RECEIPT,
  matchTags,
  decryptFile,
  tagSpec,
  tagValue,
} from "@welshman/util"
import type {Filter, TrustedEvent} from "@welshman/util"
import {ENABLE_ZAPS} from "@app/env"
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
  // An imeta tag packs its own tags into space-separated values, so unpack them.
  const imetas = matchTags(tagSpec("imeta"), event.tags).map(([, ...values]: string[]) =>
    values.map(value => value.split(" ")),
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

export const makeCommentFilter = (kinds: number[], extra: Filter = {}) => ({
  kinds: [COMMENT],
  "#K": kinds.map(String),
  ...extra,
})

export const makeDeleteFilter = (kinds: number[], extra: Filter = {}) => ({
  kinds: [DELETE],
  "#k": kinds.map(String),
  ...extra,
})

export const REPOST_KINDS = [REPOST, GENERIC_REPOST]

export const EVENT_CONTEXT_KINDS = [REPORT, REACTION, ZAP_RECEIPT, COMMENT]

export const REACTION_KINDS = [REPORT, DELETE, REACTION]

if (ENABLE_ZAPS) {
  REACTION_KINDS.push(ZAP_RECEIPT)
}

export const CONTENT_KINDS = [ZAP_GOAL, EVENT_TIME, THREAD, CLASSIFIED, POLL, PINBOARD, LONG_FORM]

const CONTENT_NOUNS = new Map([
  [ZAP_GOAL, ["goal", "goals"]],
  [EVENT_TIME, ["event", "events"]],
  [THREAD, ["thread", "threads"]],
  [CLASSIFIED, ["classified", "classifieds"]],
  [POLL, ["poll", "polls"]],
  [PINBOARD, ["pinboard", "pinboards"]],
  [LONG_FORM, ["article", "articles"]],
])

export const displayContentCount = (kind: number, count: number) => {
  const [singular, plural] = CONTENT_NOUNS.get(kind) ?? ["item", "items"]

  return `${count} ${count === 1 ? singular : plural}`
}

export const DM_KINDS = [DIRECT_MESSAGE, DIRECT_MESSAGE_FILE]

export const displayReaction = (content: string) => {
  if (!content || content === "+") {
    return "❤️"
  }
  if (content === "-") {
    return "👎"
  }
  return content
}
