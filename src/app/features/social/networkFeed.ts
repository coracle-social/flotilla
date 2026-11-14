import {derived, readable} from "svelte/store"
import type {Readable} from "svelte/store"
import {synced} from "@welshman/store"
import {GENERIC_REPOST, NOTE, REACTION, REPOST, ZAP_RECEIPT} from "@welshman/util"
import type {Filter, TrustedEvent} from "@welshman/util"
import {ENABLE_ZAPS} from "@app/core/env"
import {kv} from "@app/core/storage"
import {userFollowPubkeys} from "@app/core/user"
import {makeEngagement} from "@app/features/engagement"
import {makeAuthorFeed} from "@app/features/feeds/authorFeed"
import type {AuthorFeed} from "@app/features/feeds/authorFeed"
import {derivePinnedEvents} from "@app/features/pins"
import {CONTENT_KINDS} from "@app/features/spaces/content"
import {makeNoteFeed} from "@app/features/social/noteFeed"
import type {NoteFeed} from "@app/features/social/noteFeed"
import type {NoteFacet} from "@app/features/social/noteGroups"

const isNoteFacet = (value: unknown): value is NoteFacet =>
  value === "notes" || value === "replies" || value === "interactions"

// The stored key outlives the facet's old names, so a "popular" or "engaged" comes back as interactions.
const readIncludedNoteFacets = async (key: string): Promise<NoteFacet[] | undefined> => {
  const stored = await kv.get<unknown[]>(key)

  if (Array.isArray(stored)) {
    const migrated = stored.map(value =>
      value === "popular" || value === "engaged" ? "interactions" : value,
    )

    return migrated.filter(isNoteFacet)
  }
}

export const includedNoteFacets = synced<NoteFacet[]>({
  key: "includedNetworkFeedTypes",
  defaultValue: ["notes", "replies"],
  storage: {get: readIncludedNoteFacets, set: kv.set},
})

export const makeNotesSource = (
  pubkeys: Readable<string[]>,
  onEvent?: (event: TrustedEvent) => void,
): AuthorFeed =>
  makeAuthorFeed({
    pubkeys,
    onEvent,
    getFilters: authors => [{kinds: [NOTE, ...CONTENT_KINDS], authors}],
  })

export const makeInteractionsSource = (pubkeys: Readable<string[]>): AuthorFeed =>
  makeAuthorFeed({
    pubkeys,
    getFilters: authors => {
      const filters: Filter[] = [{kinds: [REACTION, REPOST, GENERIC_REPOST], authors}]

      // A receipt is published by the recipient's wallet, which names the zapper in its P tag.
      if (ENABLE_ZAPS) {
        filters.push({kinds: [ZAP_RECEIPT], "#P": authors})
      }

      return filters
    },
  })

export const makeNetworkFeed = (): NoteFeed => {
  const engagement = makeEngagement({withReplies: true})

  const notes = makeNotesSource(userFollowPubkeys, engagement.track)

  // Interactions is asked for once its facet is first shown, and its count stays live after that.
  const shown = readable(false, set =>
    includedNoteFacets.subscribe($facets => {
      if ($facets.includes("interactions")) {
        set(true)
      }
    }),
  )

  const interactionPubkeys = derived([userFollowPubkeys, shown], ([$pubkeys, $shown]) =>
    $shown ? $pubkeys : [],
  )

  const interactions = makeInteractionsSource(interactionPubkeys)

  return makeNoteFeed({notes, interactions, included: includedNoteFacets, engagement})
}

export const makeProfileFeed = (pubkey: string): NoteFeed => {
  const engagement = makeEngagement({withReplies: true})

  return makeNoteFeed({
    notes: makeNotesSource(readable([pubkey]), engagement.track),
    pinned: derivePinnedEvents(pubkey),
    engagement,
  })
}
