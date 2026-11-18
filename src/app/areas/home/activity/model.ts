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
import type {Activity} from "@app/tools/activity"
import {CONTENT_KINDS} from "@app/tools/content"
import {getTargetRef, isReplyKind} from "@app/tools/targets"

export type ActivityFacet = "mentions" | "spaces" | "replies" | "reactions" | "zaps"

// A row of the home stream: a chat at its latest message, a space's unread content, or what was done to a note.
export type ActivityItem =
  | {type: "chat"; key: string; timestamp: number; activity: Activity}
  | {type: "space"; key: string; timestamp: number; url: string; countsByKind: Map<number, number>}
  | {
      type: "note"
      key: string
      timestamp: number
      note: TrustedEvent
      replies: TrustedEvent[]
      reactions: TrustedEvent[]
    }

export const REPOST_KINDS = [REPOST, GENERIC_REPOST]

// A report and a delete travel the same way and are nobody's good news, so this is not REACTION_KINDS.
export const ACTIVITY_KINDS = [NOTE, COMMENT, REACTION, ...REPOST_KINDS]

if (ENABLE_ZAPS) {
  ACTIVITY_KINDS.push(ZAP_RECEIPT)
}

export const getActivityFilters = (pubkey: string): Filter[] => [
  {kinds: ACTIVITY_KINDS, "#p": [pubkey]},
]

const isAnswer = (event: TrustedEvent) => isReplyKind(event) && Boolean(getTargetRef(event))

// The note an event's row shows: what it answers or reacts to, or itself when it only mentions the user.
export const getNoteRef = (event: TrustedEvent): Maybe<EventRef> => {
  const ref = getTargetRef(event)

  if (ref) {
    return ref
  }

  if (isReplyKind(event)) {
    return EventRef.fromEvent(event)
  }
}

export const getActivityFacet = (event: TrustedEvent): ActivityFacet => {
  if (event.kind === ZAP_RECEIPT) {
    return "zaps"
  }

  if (event.kind === REACTION || REPOST_KINDS.includes(event.kind)) {
    return "reactions"
  }

  return isAnswer(event) ? "replies" : "mentions"
}

export const isNoteKind = (event: TrustedEvent) =>
  event.kind === NOTE || event.kind === COMMENT || CONTENT_KINDS.includes(event.kind)

export const isActivity = (
  event: TrustedEvent,
  note: Maybe<TrustedEvent>,
  {pubkey, isMuted}: {pubkey: string; isMuted: (event: TrustedEvent) => boolean},
) => {
  if (note && isNoteKind(note) && !isMuted(note)) {
    // A zap receipt is signed by the recipient's lnurl server, so its author says nothing about the zapper.
    return event.kind === ZAP_RECEIPT || (event.pubkey !== pubkey && !isMuted(event))
  }

  return false
}

// Every chat, read or not, newest first, so the stream reads as history rather than as a queue to drain.
export const getChatItems = (activity: Activity[]) =>
  sortBy(
    item => -item.timestamp,
    activity
      .filter(({contentKind}) => !contentKind)
      .map(
        (activity): Extract<ActivityItem, {type: "chat"}> => ({
          type: "chat",
          key: activity.path,
          timestamp: activity.event.created_at,
          activity,
        }),
      ),
  )

// Counted only where unread, since a total would be the same number every day.
export const getSpaceItems = (activity: Activity[], unreadPaths: Set<string>) => {
  const byUrl = new Map<string, Extract<ActivityItem, {type: "space"}>>()

  for (const {path, url, contentKind, event} of activity) {
    if (url && contentKind && unreadPaths.has(path)) {
      const item = byUrl.get(url) ?? {
        type: "space",
        key: url,
        url,
        timestamp: 0,
        countsByKind: new Map(),
      }

      item.timestamp = Math.max(item.timestamp, event.created_at)
      item.countsByKind.set(contentKind, (item.countsByKind.get(contentKind) ?? 0) + 1)
      byUrl.set(url, item)
    }
  }

  return sortBy(item => -item.timestamp, [...byUrl.values()])
}

type NoteGroup = {
  key: string
  ref: EventRef
  replies: TrustedEvent[]
  reactions: TrustedEvent[]
  timestamp: number
}

// Two groups in a row about one note read as a duplicate, whatever bucket split them.
const mergeAdjacent = (groups: NoteGroup[]) => {
  const result: NoteGroup[] = []

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

const groupByNote = (events: TrustedEvent[]) => {
  const groups = new Map<string, NoteGroup>()

  for (const event of events) {
    const ref = getNoteRef(event)
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

// A group shows once its note has loaded, keyed by the note's id or address.
export const getNoteItems = (events: TrustedEvent[], notes: Map<string, TrustedEvent>) =>
  groupByNote(events).flatMap(({key, ref, replies, reactions, timestamp}): ActivityItem[] => {
    const noteKey = ref.getAddressOrId()
    const note = noteKey ? notes.get(noteKey) : undefined

    return note ? [{type: "note", key, timestamp, note, replies, reactions}] : []
  })
