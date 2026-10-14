import {formatTimestampAsDate, int, MINUTE} from "@welshman/lib"
import type {Maybe} from "@welshman/lib"
import type {TrustedEvent} from "@welshman/util"

// A row of a room transcript: a message, a date divider, or the reader's unread marker.
export type RoomRow =
  | {type: "new-messages"; id: string}
  | {type: "date"; id: string; value: string}
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
  pubkey: string
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
  let previousDate: Maybe<string>
  let previousKind: Maybe<number>
  let previousPubkey: Maybe<string>
  let previousCreatedAt = 0

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
      rows.push({type: "new-messages", id: "new-messages"})
      markedUnread = true
    }

    if (date !== previousDate) {
      rows.push({type: "date", id: date, value: date})
    }

    rows.push({
      type: "note",
      id: event.id,
      value: event,
      showPubkey:
        previousPubkey !== event.pubkey ||
        event.created_at - previousCreatedAt > int(3, MINUTE) ||
        previousKind === addMemberKind,
    })

    previousDate = date
    previousKind = event.kind
    previousPubkey = event.pubkey
    previousCreatedAt = event.created_at
  }

  rows.reverse()

  return rows
}
