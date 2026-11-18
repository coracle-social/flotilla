import {batcher, pushToMapKey, spec, uniqBy} from "@welshman/lib"
import {
  DELETE,
  GENERIC_REPOST,
  NOTE,
  REACTION,
  REPORT,
  REPOST,
  ZAP_RECEIPT,
  getAddress,
  getCommentFiltersForParent,
  getReplyFilters,
  inbox,
  isReplaceable,
} from "@welshman/util"
import type {Filter, TrustedEvent} from "@welshman/util"
import {REACTION_KINDS} from "@app/core/env"
import {network, router} from "@app/core/plugins"

// Events of the kinds that name these in an e tag, or in an a tag when they have an address.
const getTargetFilters = (events: TrustedEvent[], kinds: number[]): Filter[] => {
  const filters: Filter[] = [{kinds, "#e": events.map(event => event.id)}]
  const addresses = events.filter(isReplaceable).map(getAddress)

  if (addresses.length > 0) {
    filters.push({kinds, "#a": addresses})
  }

  return filters
}

export const getReactionFilters = (events: TrustedEvent[]) =>
  getTargetFilters(events, [REACTION, ZAP_RECEIPT, REPORT, REPOST, GENERIC_REPOST])

// Comments whose parent is the event, and kind 1 replies when it is a kind 1 note.
export const getRepliesFilters = (events: TrustedEvent[]) => {
  const notes = events.filter(spec({kind: NOTE}))
  const filters = getCommentFiltersForParent(events)

  if (notes.length > 0) {
    filters.push(...getReplyFilters(notes, {kinds: [NOTE]}))
  }

  return filters
}

type LoadRequest = {event: TrustedEvent; url?: string}

// Asks the space's relay for a space's event, and the author's inbox for any other, then for the deletes of what came back.
const load = async (requests: LoadRequest[], getFilters: (events: TrustedEvent[]) => Filter[]) => {
  const eventsByRelay = new Map<string, TrustedEvent[]>()
  const routes = await Promise.all(
    requests.map(async ({event, url}) => ({
      event,
      relays: url ? [url] : await router.get().resolver.relays([inbox(event.pubkey)]),
    })),
  )

  for (const {event, relays} of routes) {
    for (const relay of relays) {
      pushToMapKey(eventsByRelay, relay, event)
    }
  }

  await Promise.all(
    Array.from(eventsByRelay, async ([relay, events]) => {
      const filters = getFilters(uniqBy(event => event.id, events))

      try {
        const found = await network.get().load({relays: [relay], filters, timeout: 3000})

        if (found.length > 0) {
          await network.get().load({relays: [relay], filters: getTargetFilters(found, [DELETE])})
        }
      } catch (error) {
        console.error(error)
      }
    }),
  )
}

// A render's rows ask within 300ms of each other, so each batch waits that long and goes out together.
const reactionBatch = batcher(300, async (requests: LoadRequest[]) => {
  await load(requests, events =>
    getTargetFilters(events, [...REACTION_KINDS, REPOST, GENERIC_REPOST]),
  )

  return requests.map(() => undefined)
})

const repliesBatch = batcher(300, async (requests: LoadRequest[]) => {
  await load(requests, getRepliesFilters)

  return requests.map(() => undefined)
})

/** Loads into the repository what reacts to an event, batched with every other row asking. */
export const loadReactions = (event: TrustedEvent, url?: string) => reactionBatch({event, url})

/** Loads into the repository the comments and kind 1 replies to an event, batched with every other row asking. */
export const loadReplies = (event: TrustedEvent, url?: string) => repliesBatch({event, url})
