import type {Readable} from "svelte/store"
import type {Maybe} from "@welshman/lib"
import {GENERIC_REPOST, NOTE, REACTION, REPOST, ZAP_RECEIPT} from "@welshman/util"
import type {EventRef, Filter, TrustedEvent} from "@welshman/util"
import {ENABLE_ZAPS} from "@app/core/env"
import {CONTENT_KINDS} from "@app/features/spaces"
import {makeGroupedFeed} from "@app/features/feeds"
import type {GroupedFeed} from "@app/features/feeds"
import {getAnsweredRef} from "@app/features/social/replies"

export type NoteFacet = "notes" | "replies" | "engaged"

// Only a kind 1 carries NIP-10 reply tags, so an article or a poll in the feed is a note.
export const getNoteAnswer = (event: TrustedEvent): Maybe<EventRef> =>
  event.kind === NOTE ? getAnsweredRef(event) : undefined

export const classifyNote = (event: TrustedEvent): NoteFacet =>
  getNoteAnswer(event) ? "replies" : "notes"

// A source whose events are drawn as they are.
export type ContentSource = GroupedFeed & {
  produces: ["notes", "replies"]
  classify: (event: TrustedEvent) => NoteFacet
  target?: undefined
}

// A source whose events name a note, which has to be loaded before it can be drawn.
export type ReferenceSource = GroupedFeed & {
  produces: ["engaged"]
  target: (event: TrustedEvent) => Maybe<EventRef>
}

export type NoteSource = ContentSource | ReferenceSource

// The notes a set of follows published, alongside the content kinds their spaces give a page of their own.
export const makeNotesSource = ({
  onEvent,
  pubkeys,
}: {
  onEvent: (event: TrustedEvent) => void
  pubkeys: Readable<string[]>
}): ContentSource => ({
  ...makeGroupedFeed({
    getFilters: authors => [{kinds: [NOTE, ...CONTENT_KINDS], authors}],
    onEvent,
    pubkeys,
  }),
  produces: ["notes", "replies"],
  classify: classifyNote,
})

/** The notes the reader's follows liked, reposted or zapped, as references the feed resolves. */
export const makeEngagedSource = ({pubkeys}: {pubkeys: Readable<string[]>}): ReferenceSource => ({
  ...makeGroupedFeed({
    getFilters: authors => {
      // A like and a repost both name what they answer.
      const filters: Filter[] = [{kinds: [REACTION, REPOST, GENERIC_REPOST], authors}]

      // A receipt pays its recipient rather than being published by the zapper, so it is found by who it names.
      if (ENABLE_ZAPS) {
        filters.push({kinds: [ZAP_RECEIPT], "#p": authors})
      }

      return filters
    },
    pubkeys,
  }),
  produces: ["engaged"],
  target: getAnsweredRef,
})
