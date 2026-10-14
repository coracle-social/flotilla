import {ago, HOUR, int, max, sortBy} from "@welshman/lib"
import type {Maybe} from "@welshman/lib"
import {
  COMMENT,
  EventRef,
  GENERIC_REPOST,
  NOTE,
  REPOST,
  getRelayHints,
  matchTag,
  tagSpec,
  tagValue,
} from "@welshman/util"
import type {TrustedEvent} from "@welshman/util"
import {Comment} from "@welshman/domain"
import {reader} from "@app/core/domain"
import {getReplyRefs, isReplyKind} from "@app/features/social"

export const REPOST_KINDS = [REPOST, GENERIC_REPOST]

// One entry in the home notifications feed: a note, who answered it, and who reacted to it.
export type HomeNotification = {
  key: string
  ref: EventRef
  replies: TrustedEvent[]
  reactions: TrustedEvent[]
  timestamp: number
}

// What a notification is about: the note it answers or reacts to, or itself when it is a mention.
export const getNotificationRef = (event: TrustedEvent): Maybe<EventRef> => {
  if (isReplyKind(event)) {
    const {parent, root} = getReplyRefs(event)

    return parent ?? root ?? EventRef.fromEvent(event)
  }

  // NIP-25 asks a reaction to carry the tags of the event it is about, author included.
  const tag = matchTag(tagSpec("e"), event.tags)
  const pubkey = tagValue(tagSpec("p"), event.tags)

  return tag && new EventRef({id: tag[1], pubkey, relays: getRelayHints(tag)})
}

// An entry is a note and what was done to it, so nothing else can be the note one is drawn around.
export const isNotificationTarget = (event: TrustedEvent) =>
  event.kind === NOTE || (event.kind === COMMENT && reader(Comment)(event).root()?.kind === NOTE)

// Two entries in a row about one note read as a duplicate, whatever bucket split them.
const mergeAdjacent = (notifications: HomeNotification[]) => {
  const merged: HomeNotification[] = []

  for (const notification of notifications) {
    const previous = merged[merged.length - 1]

    if (previous?.ref.getAddressOrId() === notification.ref.getAddressOrId()) {
      merged[merged.length - 1] = {
        ...previous,
        ref: EventRef.merge(previous.ref, notification.ref),
        replies: [...previous.replies, ...notification.replies],
        reactions: [...previous.reactions, ...notification.reactions],
      }
    } else {
      merged.push(notification)
    }
  }

  return merged
}

// Everything done to one note collapses into a single entry rather than one per answer.
export const groupNotifications = (events: TrustedEvent[]) => {
  const interval = int(HOUR, 3)
  const notifications = new Map<string, HomeNotification>()

  for (const event of events) {
    const ref = getNotificationRef(event)
    const target = ref?.getAddressOrId()

    if (ref && target) {
      // The window is measured back from now, so two answers minutes apart never straddle an edge.
      const key = `${target}:${Math.round(ago(event.created_at) / interval)}`
      const notification = notifications.get(key) ?? {
        key,
        ref,
        replies: [],
        reactions: [],
        timestamp: 0,
      }

      if (ref.id !== event.id) {
        const answers = isReplyKind(event) ? notification.replies : notification.reactions

        answers.push(event)
      }

      notifications.set(key, {
        ...notification,
        ref: EventRef.merge(notification.ref, ref),
        timestamp: max([notification.timestamp, event.created_at]),
      })
    }
  }

  return mergeAdjacent(
    sortBy(notification => -notification.timestamp, Array.from(notifications.values())),
  )
}
