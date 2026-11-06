import {max, partition, sortBy, spec} from "@welshman/lib"
import {
  CLASSIFIED,
  EVENT_TIME,
  LONG_FORM,
  PINBOARD,
  POLL,
  THREAD,
  ZAP_GOAL,
  getIdOrAddress,
} from "@welshman/util"
import type {TrustedEvent} from "@welshman/util"
import {Comment, Thread} from "@welshman/domain"
import {reader} from "@app/core/domain"
import {makeFeed} from "@app/features/feeds"

// The kinds that each have a section of their own in a space.
export const CONTENT_KINDS = [ZAP_GOAL, EVENT_TIME, THREAD, CLASSIFIED, POLL, PINBOARD, LONG_FORM]

// An event is active as of its own creation or the newest comment on it, keyed by address when addressable.
export const partitionByActivity = (kind: number, events: TrustedEvent[]) => {
  const [items, comments] = partition(spec({kind}), events)
  const commentedAt = new Map<string, number>()

  for (const comment of comments) {
    const root = reader(Comment)(comment).root()
    const key = root?.getAddressOrId()

    if (key) {
      commentedAt.set(key, max([commentedAt.get(key), comment.created_at]))
    }
  }

  const activeAt = new Map(
    items.map(event => [event.id, max([commentedAt.get(getIdOrAddress(event)), event.created_at])]),
  )

  return {items: sortBy(event => -(activeAt.get(event.id) ?? 0), items), activeAt}
}

// The title goes in twice, so the words that name a thread's topic weigh double.
export const threadText = (event: TrustedEvent) => {
  const title = reader(Thread)(event).title() ?? ""

  return `${title} ${title} ${event.content}`
}

export const makeThreadFeed = (url: string) =>
  makeFeed({relays: [url], filters: [{kinds: [THREAD]}]})
