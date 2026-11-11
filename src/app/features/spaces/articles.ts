import {sortBy} from "@welshman/lib"
import type {TrustedEvent} from "@welshman/util"
import {LONG_FORM} from "@welshman/util"
import {Article} from "@welshman/domain"
import {reader} from "@app/core/domain"

const WORDS_PER_MINUTE = 200

// Articles are markdown, so this counts syntax as words too.
export const displayReadingTime = (content: string) => {
  const words = content.trim().split(/\s+/).filter(Boolean).length
  const minutes = Math.max(1, Math.round(words / WORDS_PER_MINUTE))

  return `${minutes} minute${minutes === 1 ? "" : "s"}`
}

// An article is addressable, so its created_at moves with every edit. published_at is when it went out.
const getArticleTimestamp = (event: TrustedEvent) => reader(Article)(event).publishedAt()

// When a post went out: an article's publication date, a note's creation time.
export const getPublishedTimestamp = (event: TrustedEvent) =>
  event.kind === LONG_FORM ? getArticleTimestamp(event) : event.created_at

export const sortArticles = (events: TrustedEvent[]) =>
  sortBy(event => -getArticleTimestamp(event), events)
