import {max, partition, sortBy, spec} from "@welshman/lib"
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
  getIdOrAddress,
  isReplaceableKind,
  tagSpec,
  tagValue,
} from "@welshman/util"
import type {Filter, TrustedEvent} from "@welshman/util"
import {Comment} from "@welshman/domain"
import {reader} from "@app/core"
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

// What an event is activity on: the root a comment sits under, or the event itself.
export const getActivityTarget = (event: TrustedEvent) => {
  if (event.kind === COMMENT) {
    const {kind, id, address} = reader(Comment)(event).root()
    const rootKind = parseInt(kind || "")
    const idOrAddress = address || id

    if (rootKind && idOrAddress) {
      return {kind: rootKind, idOrAddress}
    }
  }

  return {kind: event.kind, idOrAddress: getIdOrAddress(event)}
}

// An event is active as of its own creation or the newest comment on it, keyed by address when addressable.
export const partitionByActivity = (kind: number, events: TrustedEvent[]) => {
  const [items, comments] = partition(spec({kind}), events)
  const commentedAt = new Map<string, number>()

  for (const comment of comments) {
    const {id, address} = reader(Comment)(comment).root()
    const key = isReplaceableKind(kind) ? address : id

    if (key) {
      commentedAt.set(key, max([commentedAt.get(key), comment.created_at]))
    }
  }

  const activeAt = new Map(
    items.map(event => [event.id, max([commentedAt.get(getIdOrAddress(event)), event.created_at])]),
  )

  return {items: sortBy(event => -(activeAt.get(event.id) ?? 0), items), activeAt}
}

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
