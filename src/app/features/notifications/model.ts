import type {Maybe} from "@welshman/lib"
import {HOUR, int, max, now, sortBy} from "@welshman/lib"
import {
  COMMENT,
  EventRef,
  GENERIC_REPOST,
  NOTE,
  REACTION,
  REPOST,
  ZAP_RECEIPT,
} from "@welshman/util"
import type {Filter, TrustedEvent} from "@welshman/util"
import {ENABLE_ZAPS} from "@app/core/env"
import {CONTENT_KINDS} from "@app/features/spaces/content"
import {getTargetRef, isReplyKind} from "@app/features/social/targets"

export type NotificationFacet = "mentions" | "spaces" | "replies" | "reactions" | "zaps"

export const REPOST_KINDS = [REPOST, GENERIC_REPOST]

// A report and a delete travel the same way and are nobody's good news, so this is not REACTION_KINDS.
export const NOTIFICATION_KINDS = [NOTE, COMMENT, REACTION, ...REPOST_KINDS]

if (ENABLE_ZAPS) {
  NOTIFICATION_KINDS.push(ZAP_RECEIPT)
}

export const getNotificationFilters = (pubkey: string): Filter[] => [
  {kinds: NOTIFICATION_KINDS, "#p": [pubkey]},
]

export type NotificationGroup = {
  key: string
  ref: EventRef
  replies: TrustedEvent[]
  reactions: TrustedEvent[]
  timestamp: number
}

const isAnswer = (event: TrustedEvent) => isReplyKind(event) && Boolean(getTargetRef(event))

export const getNotificationRef = (event: TrustedEvent): Maybe<EventRef> => {
  const ref = getTargetRef(event)

  if (ref) {
    return ref
  }

  if (isReplyKind(event)) {
    return EventRef.fromEvent(event)
  }
}

export const getNotificationFacet = (event: TrustedEvent): NotificationFacet => {
  if (event.kind === ZAP_RECEIPT) {
    return "zaps"
  }

  if (event.kind === REACTION || REPOST_KINDS.includes(event.kind)) {
    return "reactions"
  }

  return isAnswer(event) ? "replies" : "mentions"
}

export const isNotificationTarget = (event: TrustedEvent) =>
  event.kind === NOTE || event.kind === COMMENT || CONTENT_KINDS.includes(event.kind)

export const isNotification = (
  event: TrustedEvent,
  target: Maybe<TrustedEvent>,
  {pubkey, isMuted}: {pubkey: string; isMuted: (event: TrustedEvent) => boolean},
) => {
  if (target && isNotificationTarget(target) && !isMuted(target)) {
    // A zap receipt is signed by the recipient's lnurl server, so its author says nothing about the zapper.
    return event.kind === ZAP_RECEIPT || (event.pubkey !== pubkey && !isMuted(event))
  }

  return false
}

// Two groups in a row about one note read as a duplicate, whatever bucket split them.
const mergeAdjacent = (groups: NotificationGroup[]) => {
  const result: NotificationGroup[] = []

  for (const group of groups) {
    const previous = result.at(-1)
    const key = previous?.ref.getAddressOrId()

    if (previous && key && key === group.ref.getAddressOrId()) {
      result[result.length - 1] = {
        ...previous,
        ref: EventRef.merge(previous.ref, group.ref),
        replies: [...previous.replies, ...group.replies],
        reactions: [...previous.reactions, ...group.reactions],
      }
    } else {
      result.push(group)
    }
  }

  return result
}

export const groupNotifications = (events: TrustedEvent[]) => {
  const groups = new Map<string, NotificationGroup>()

  for (const event of events) {
    const ref = getNotificationRef(event)
    const target = ref?.getAddressOrId()

    if (ref && target) {
      // The bucket is measured back from now, so two answers minutes apart never straddle an edge.
      const key = `${target}:${Math.round((now() - event.created_at) / int(3, HOUR))}`
      const group = groups.get(key) ?? {key, ref, replies: [], reactions: [], timestamp: 0}
      const replies = isAnswer(event) ? [...group.replies, event] : group.replies
      const reactions = isReplyKind(event) ? group.reactions : [...group.reactions, event]

      groups.set(key, {
        key,
        ref: EventRef.merge(group.ref, ref),
        replies,
        reactions,
        timestamp: max([group.timestamp, event.created_at]),
      })
    }
  }

  return mergeAdjacent(sortBy(group => -group.timestamp, groups.values()))
}
