import {derived} from "svelte/store"
import type {Readable} from "svelte/store"
import type {Maybe} from "@welshman/lib"
import {COMMENT, GENERIC_REPOST, NOTE, REACTION, REPOST, ZAP_RECEIPT} from "@welshman/util"
import type {TrustedEvent} from "@welshman/util"
import {Events} from "@welshman/app"
import {ZapReceipt} from "@welshman/domain"
import {fromApp} from "@app/core/app"
import {ENABLE_ZAPS} from "@app/core/env"
import {reader} from "@app/core/domain"
import {
  getReactionFilters,
  getRepliesFilters,
  loadReactions,
  loadReplies,
} from "@app/tools/interactions/interactions"

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

// The zapper and the amount are in the receipt itself, so this needs no lnurl round trip.
const readZap = (event: TrustedEvent): Maybe<ZapStat> => {
  const receipt = reader(ZapReceipt)(event)
  const pubkey = receipt.sender()
  const amount = receipt.invoiceAmount()

  return pubkey && amount ? {pubkey, msats: amount, timestamp: event.created_at} : undefined
}

export const deriveNoteStats = (event: TrustedEvent, url?: string): Readable<NoteStats> => {
  loadReactions(event, url)
  loadReplies(event, url)

  const filters = [...getReactionFilters([event]), ...getRepliesFilters([event])]

  return derived(
    fromApp($app => $app.use(Events).desc(filters).$),
    events => {
      const stats: NoteStats = {comments: [], reactions: [], reposts: [], zaps: []}

      for (const related of events) {
        if (related.kind === NOTE || related.kind === COMMENT) {
          stats.comments.push(related)
        } else if (related.kind === REACTION) {
          stats.reactions.push(related)
        } else if (related.kind === REPOST || related.kind === GENERIC_REPOST) {
          stats.reposts.push(related)
        } else if (related.kind === ZAP_RECEIPT && ENABLE_ZAPS) {
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
