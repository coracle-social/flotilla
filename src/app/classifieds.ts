import {max, partition, pushToMapKey, sortBy, spec} from "@welshman/lib"
import type {TrustedEvent} from "@welshman/util"
import {CLASSIFIED, tagSpec, tagValue} from "@welshman/util"
import {Classified} from "@welshman/domain"
import {normalizeTopic} from "@lib/util"
import {reader} from "@app/core"

export const CLASSIFIED_STATUS_TABS = [
  {value: "all", label: "All"},
  {value: "active", label: "Active"},
  {value: "sold", label: "Sold"},
]

export const SUGGESTED_TOPICS = ["for sale", "wanted", "job", "service", "free"]

// Splits a feed into listings and their comments, scoring each listing by last activity.
export const partitionListings = (events: TrustedEvent[]) => {
  const scores = new Map<string, number[]>()
  const [listings, comments] = partition(spec({kind: CLASSIFIED}), events)

  for (const comment of comments) {
    const id = tagValue(tagSpec("E"), comment.tags)

    if (id) {
      pushToMapKey(scores, id, comment.created_at)
    }
  }

  const activeAt = new Map<string, number>()

  for (const listing of listings) {
    activeAt.set(listing.id, max([...(scores.get(listing.id) || []), listing.created_at]))
  }

  return {listings, activeAt}
}

export const deriveTopicCounts = (events: TrustedEvent[]) => {
  const counts = new Map<string, number>()

  for (const event of events) {
    for (const topic of reader(Classified)(event).topics() ?? []) {
      const normalized = normalizeTopic(topic)

      counts.set(normalized, (counts.get(normalized) || 0) + 1)
    }
  }

  return sortBy(([, count]) => -count, Array.from(counts.entries()))
}

export const getStatus = (event: TrustedEvent) => reader(Classified)(event).status() ?? "active"

export const matchesTopic = (event: TrustedEvent, topic: string) =>
  !topic ||
  Boolean(
    reader(Classified)(event)
      .topics()
      ?.some(t => normalizeTopic(t) === topic),
  )

export const matchesQuery = (event: TrustedEvent, query: string) => {
  const q = query.trim().toLowerCase()

  if (!q) return true

  const classified = reader(Classified)(event)
  const haystack = [classified.title(), classified.summary(), event.content]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()

  return haystack.includes(q)
}
