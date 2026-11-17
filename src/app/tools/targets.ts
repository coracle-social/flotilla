import {Comment, Note, ZapReceipt} from "@welshman/domain"
import type {Maybe} from "@welshman/lib"
import {last} from "@welshman/lib"
import {
  COMMENT,
  EventRef,
  GENERIC_REPOST,
  NOTE,
  REACTION,
  REPOST,
  ZAP_RECEIPT,
  addressTags,
  getIdAndAddress,
  getRelayHints,
  hexTags,
  matchTag,
  matchTags,
  tagValues,
} from "@welshman/util"
import type {TrustedEvent} from "@welshman/util"
import {reader} from "@app/core/domain"

export const isReplyKind = (event: TrustedEvent) => event.kind === NOTE || event.kind === COMMENT

export type ThreadRefs = {parent?: EventRef; root?: EventRef}

export const getThreadRefs = (event: TrustedEvent): ThreadRefs => {
  if (event.kind === NOTE) {
    const note = reader(Note)(event)

    return {parent: note.parent(), root: note.root()}
  }

  if (event.kind === COMMENT) {
    const comment = reader(Comment)(event)

    return {parent: comment.parent(), root: comment.root()}
  }

  return {}
}

// NIP-25 names a reaction's target and author last, though an address carries its own author.
const getTaggedRef = (tags: string[][]): Maybe<EventRef> => {
  const tag = matchTag(addressTags("a"), tags) ?? last(matchTags(hexTags("e"), tags))

  if (tag) {
    const ref = EventRef.fromString(tag[1], getRelayHints(tag))

    return EventRef.merge(ref, {pubkey: last(tagValues(hexTags("p"), tags))})
  }
}

const readTargetRef = (event: TrustedEvent): Maybe<EventRef> => {
  if (isReplyKind(event)) {
    const {parent, root} = getThreadRefs(event)

    return parent ?? root
  }

  if (event.kind === ZAP_RECEIPT) {
    const request = reader(ZapReceipt)(event).parse().request()

    return getTaggedRef(event.tags) ?? getTaggedRef(request?.tags ?? [])
  }

  if (event.kind === REACTION || event.kind === REPOST || event.kind === GENERIC_REPOST) {
    return getTaggedRef(event.tags)
  }
}

// Reading a ref parses every relay hint, and a feed asks again for each event whenever it redraws
const targetRefs = new WeakMap<TrustedEvent, Maybe<EventRef>>()

export const getTargetRef = (event: TrustedEvent): Maybe<EventRef> => {
  if (targetRefs.has(event)) {
    return targetRefs.get(event)
  }

  const ref = readTargetRef(event)

  targetRefs.set(event, ref)

  return ref
}

export const getTargetKeys = (event: TrustedEvent) => getTargetRef(event)?.getIdAndAddress() ?? []

export const isReplyTo = (event: TrustedEvent, target: TrustedEvent) => {
  const targetKeys = getIdAndAddress(target)

  return isReplyKind(event) && getTargetKeys(event).some(key => targetKeys.includes(key))
}
