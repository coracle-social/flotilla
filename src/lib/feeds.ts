import {fromPairs, parseJson, randomId} from "@welshman/lib"
import {FEED, Address} from "@welshman/util"
import type {TrustedEvent} from "@welshman/util"
import {
  makeIntersectionFeed,
  hasSubFeeds,
  isTagFeed,
  isAuthorFeed,
  isScopeFeed,
} from "@welshman/feeds"
import type {Feed as IFeed} from "@welshman/feeds"

export type Feed = {
  title: string
  identifier: string
  description: string
  definition: IFeed
  event?: TrustedEvent
}

export type PublishedFeed = Omit<Feed, "event"> & {
  event: TrustedEvent
}

export const normalizeFeedDefinition = (feed: IFeed) =>
  hasSubFeeds(feed) ? feed : makeIntersectionFeed(feed)

export const makeFeed = (feed: Partial<Feed> = {}): Feed => ({
  title: "",
  description: "",
  identifier: randomId(),
  definition: makeIntersectionFeed(),
  ...feed,
})

export const readFeed = (event: TrustedEvent) => {
  const {d: identifier, title = "", description = "", feed = ""} = fromPairs(event.tags)
  const definition = parseJson(feed) || makeIntersectionFeed()

  return {title, identifier, description, definition, event} as PublishedFeed
}

export const createFeed = ({identifier, definition, title, description}: Feed) => ({
  kind: FEED,
  content: "",
  tags: [
    ["d", identifier],
    ["alt", title],
    ["title", title],
    ["description", description],
    ["feed", JSON.stringify(definition)],
  ],
})

export const editFeed = (feed: PublishedFeed) => ({
  kind: FEED,
  content: feed.event.content,
  tags: Object.entries({
    ...fromPairs(feed.event.tags),
    title: feed.title,
    alt: feed.title,
    description: feed.description,
    feed: JSON.stringify(feed.definition),
  }),
})

export const displayFeed = (feed?: Feed) => feed?.title || "[no name]"

export const isTopicFeed = (f: IFeed) => isTagFeed(f) && f[1] === "#t"

export const isMentionFeed = (f: IFeed) => isTagFeed(f) && f[1] === "#p"

export const isAddressFeed = (f: IFeed) => isTagFeed(f) && f[1] === "#a"

export const isContextFeed = (f: IFeed) =>
  isTagFeed(f) && f[1] === "#a" && f.slice(2).every(Address.isAddress)

export const isPeopleFeed = (f: IFeed) => isAuthorFeed(f) || isScopeFeed(f)
