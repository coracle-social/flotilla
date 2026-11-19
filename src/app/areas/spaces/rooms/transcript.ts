import {formatTimestampAsDate, int, MINUTE, now} from "@welshman/lib"
import type {Maybe} from "@welshman/lib"
import type {TrustedEvent} from "@welshman/util"

// A row of a room transcript: a message, a date divider, the reader's unread marker, the start of scheduled posts, or a run of joins.
export type RoomRow =
  | {type: "new-messages"; id: string}
  | {type: "scheduled"; id: string}
  | {type: "date"; id: string; value: string}
  | {type: "add-members"; id: string; value: TrustedEvent[]}
  | {type: "note"; id: string; value: TrustedEvent; showPubkey: boolean}

// Returned newest first, which is the order a reversed transcript renders in.
export const groupRoomMessages = ({
  events,
  pubkey,
  addMemberKind,
  unreadAfter,
  unreadBefore,
}: {
  events: TrustedEvent[]
  pubkey: Maybe<string>
  addMemberKind: number
  unreadAfter: number
  unreadBefore: number
}) => {
  const rows: RoomRow[] = []
  const seenIds = new Set<string>()

  // Messages the reader sent from another device aren't unread to them
  const lastOwn = events.findLast(event => event.pubkey === pubkey)
  const after = unreadAfter && lastOwn ? Math.max(lastOwn.created_at, unreadAfter) : unreadAfter

  let markedUnread = false
  let markedScheduled = false
  let previousDate: Maybe<string>
  let previousKind: Maybe<number>
  let previousPubkey: Maybe<string>
  let previousCreatedAt = 0

  // Consecutive joins collapse into one centered line, so a burst of arrivals reads as a single row.
  let joinRun: TrustedEvent[] = []

  const flushJoinRun = () => {
    if (joinRun.length > 0) {
      rows.push({type: "add-members", id: joinRun[0].id, value: joinRun})
      joinRun = []
    }
  }

  for (const event of events) {
    if (seenIds.has(event.id)) {
      continue
    }

    seenIds.add(event.id)

    const date = formatTimestampAsDate(event.created_at)

    if (
      !markedUnread &&
      after &&
      event.pubkey !== pubkey &&
      event.created_at > after &&
      event.created_at < unreadBefore
    ) {
      flushJoinRun()
      rows.push({type: "new-messages", id: "new-messages"})
      markedUnread = true
    }

    // A scheduled post is dated ahead and held by the relay, so only its author sees it this early.
    if (!markedScheduled && event.created_at > now()) {
      flushJoinRun()
      rows.push({type: "scheduled", id: "scheduled"})
      markedScheduled = true
    }

    // A day of joins holds its own line, so the divider ends the run it started.
    if (date !== previousDate) {
      flushJoinRun()
      rows.push({type: "date", id: date, value: date})
    }

    if (event.kind === addMemberKind) {
      joinRun.push(event)
    } else {
      flushJoinRun()
      rows.push({
        type: "note",
        id: event.id,
        value: event,
        showPubkey:
          previousPubkey !== event.pubkey ||
          event.created_at - previousCreatedAt > int(3, MINUTE) ||
          previousKind === addMemberKind,
      })
    }

    previousDate = date
    previousKind = event.kind
    previousPubkey = event.pubkey
    previousCreatedAt = event.created_at
  }

  flushJoinRun()

  rows.reverse()

  return rows
}
