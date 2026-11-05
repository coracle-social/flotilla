import {derived} from "svelte/store"
import type {Readable} from "svelte/store"
import {noop} from "@welshman/lib"
import type {Maybe} from "@welshman/lib"
import {
  COMMENT,
  GENERIC_REPOST,
  NOTE,
  REACTION,
  REPOST,
  ZAP_RECEIPT,
  getCommentFiltersForRoot,
  getReplyFilters,
} from "@welshman/util"
import type {Filter, TrustedEvent} from "@welshman/util"
import {Events} from "@welshman/app"
import {ZapReceipt} from "@welshman/domain"
import {fromApp} from "@app/core/app"
import {ENABLE_ZAPS} from "@app/core/env"
import {reader} from "@app/core/domain"
import {network} from "@app/core/plugins"
import {notes} from "@app/features/social/notes"

export type ZapStat = {
  pubkey: string
  msats: number
  timestamp: number
}

export type NoteStats = {
  comments: TrustedEvent[]
  reactions: TrustedEvent[]
  reposts: TrustedEvent[]
  zaps: ZapStat[]
}

// A note's comments point at it as their root, a comment's answers point at it as their parent.
const getStatFilters = (event: TrustedEvent): Filter[] => {
  const kinds = [NOTE, COMMENT, REACTION, REPOST, GENERIC_REPOST]

  if (ENABLE_ZAPS) {
    kinds.push(ZAP_RECEIPT)
  }

  return [...getReplyFilters([event], {kinds}), ...getCommentFiltersForRoot([event])]
}

// The zapper and the amount are in the receipt itself, so this needs no lnurl round trip.
const readZap = (event: TrustedEvent): Maybe<ZapStat> => {
  const receipt = reader(ZapReceipt)(event)
  const pubkey = receipt.sender()
  const amount = receipt.invoiceAmount()

  return pubkey && amount ? {pubkey, msats: amount, timestamp: event.created_at} : undefined
}

const loadStats = (event: TrustedEvent) => {
  const filters = getStatFilters(event)

  notes
    .get()
    .relays(event)
    .then(relays => network.get().request({relays, filters}))
    .catch(noop)
}

export const deriveNoteStats = (event: TrustedEvent): Readable<NoteStats> => {
  loadStats(event)

  return derived(
    fromApp($app => $app.use(Events).desc(getStatFilters(event)).$),
    events => {
      const stats: NoteStats = {comments: [], reactions: [], reposts: [], zaps: []}

      for (const related of events) {
        if (related.kind === NOTE || related.kind === COMMENT) {
          stats.comments.push(related)
        } else if (related.kind === REACTION) {
          stats.reactions.push(related)
        } else if (related.kind === REPOST || related.kind === GENERIC_REPOST) {
          stats.reposts.push(related)
        } else if (related.kind === ZAP_RECEIPT) {
          const zap = readZap(related)

          if (zap) {
            stats.zaps.push(zap)
          }
        }
      }

      return stats
    },
  )
}
