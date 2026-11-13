import {last} from "@welshman/lib"
import type {Maybe} from "@welshman/lib"
import {
  EventRef,
  GENERIC_REPOST,
  REACTION,
  REPOST,
  ZAP_RECEIPT,
  addressTags,
  getRelayHints,
  hexTags,
  matchTag,
  matchTags,
  tagSpec,
  tagValue,
} from "@welshman/util"
import type {Filter, TrustedEvent} from "@welshman/util"
import {ZapReceipt} from "@welshman/domain"
import {reader} from "@app/core/domain"
import {ENABLE_ZAPS} from "@app/core/env"
import type {ReferenceSource} from "@app/features/social/noteFeed"
import {makeTimeline} from "@app/features/social/timeline"
import type {Timeline} from "@app/features/social/timeline"

// An a tag names an addressable event, and NIP-25 names any other in the last e tag.
const getTargetTag = (tags: string[][]): Maybe<string[]> =>
  matchTag(addressTags("a"), tags) ?? last(matchTags(hexTags("e"), tags))

// A zap receipt is signed by the recipient's wallet, so the request inside it names what was zapped.
const getTarget = (event: TrustedEvent): Maybe<EventRef> => {
  const receipt = event.kind === ZAP_RECEIPT ? reader(ZapReceipt)(event).parse() : undefined
  const tagGroups = receipt ? [event.tags, receipt.request()?.tags ?? []] : [event.tags]

  for (const tags of tagGroups) {
    const tag = getTargetTag(tags)

    if (tag) {
      const target = EventRef.fromString(tag[1], getRelayHints(tag))

      return EventRef.merge({pubkey: tagValue(tagSpec("p"), tags)}, target)
    }
  }
}

/** The notes the reader's follows liked, reposted or zapped, as references the feed resolves. */
export const makePopularFeed = (): ReferenceSource & Pick<Timeline, "start"> => {
  const timeline = makeTimeline({
    getFilters: pubkeys => {
      // A like and a repost both name what they answer.
      const filters: Filter[] = [{kinds: [REACTION, REPOST, GENERIC_REPOST], authors: pubkeys}]

      // A receipt pays its recipient rather than being published by the zapper, so it is found by who it names.
      if (ENABLE_ZAPS) {
        filters.push({kinds: [ZAP_RECEIPT], "#p": pubkeys})
      }

      return filters
    },
  })

  return {
    events: timeline.events,
    loading: timeline.loading,
    exhausted: timeline.exhausted,
    type: "popular",
    target: getTarget,
    page: timeline.page,
    settle: timeline.settle,
    stop: timeline.stop,
    start: timeline.start,
  }
}
