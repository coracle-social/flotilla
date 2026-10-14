import {readable} from "svelte/store"
import {call, first, pushToMapKey, removeUndefined, sortBy, uniq, uniqBy} from "@welshman/lib"
import type {Maybe} from "@welshman/lib"
import {
  COMMENT,
  EventRef,
  NOTE,
  getCommentFiltersForRoot,
  getIdAndAddress,
  hexTags,
  tagValues,
} from "@welshman/util"
import type {IEventRef, TrustedEvent} from "@welshman/util"
import {Comment, Note} from "@welshman/domain"
import {Events, Network, Router} from "@welshman/app"
import type {IApp} from "@welshman/app"
import {usePlugin} from "@app/core/plugins"
import {reader} from "@app/core/domain"

// Structure: the shape of a conversation, read off tags alone.

// Only a note or a comment answers another event, through NIP-10 or NIP-22 tags.
export const isReplyKind = (event: TrustedEvent) => event.kind === NOTE || event.kind === COMMENT

export const getReplyRefs = (event: TrustedEvent) => {
  const thread = call(() => {
    switch (event.kind) {
      case NOTE:
        return reader(Note)(event)
      case COMMENT:
        return reader(Comment)(event)
    }
  })

  return {parent: thread?.parent(), root: thread?.root()}
}

// Ids and addresses of what an event answers; NIP-25 has a reaction name its target last, as reposts and zaps do.
export const getParents = (event: TrustedEvent) => {
  if (isReplyKind(event)) {
    const {parent, root} = getReplyRefs(event)

    return (parent ?? root)?.getIdAndAddress() ?? []
  }

  return tagValues(hexTags("e"), event.tags).slice(-1)
}

// A reply names the note it answers with an `e` tag, and a deeper one names the thread root too.
export const getThreadFilters = (event: TrustedEvent) => {
  const root = event.kind === NOTE ? reader(Note)(event).root()?.id : undefined

  return [
    ...getCommentFiltersForRoot([event]),
    {kinds: [NOTE], "#e": uniq(removeUndefined([event.id, root]))},
  ]
}

// A reply names only the event above it, so the set grows a generation at a time.
export const getDescendants = (root: TrustedEvent, events: TrustedEvent[]) => {
  const values = new Set(getIdAndAddress(root))
  const descendants: TrustedEvent[] = []

  let growing = true

  while (growing) {
    growing = false

    for (const event of events) {
      if (!values.has(event.id) && getParents(event).some(value => values.has(value))) {
        for (const value of getIdAndAddress(event)) {
          values.add(value)
        }

        descendants.push(event)
        growing = true
      }
    }
  }

  return descendants
}

export type CommentNode = {
  comment: TrustedEvent
  children: CommentNode[]
}

export const buildCommentTree = (root: TrustedEvent, comments: TrustedEvent[]) => {
  const byParent = new Map<string, TrustedEvent[]>()

  // A comment names its parent by id, and by address where the parent is addressable.
  for (const comment of comments) {
    for (const parent of getParents(comment)) {
      pushToMapKey(byParent, parent, comment)
    }
  }

  // Nothing stops a comment naming several parents, which would let the tree cycle.
  const seenIds = new Set<string>()

  const build = (parent: TrustedEvent): CommentNode[] => {
    const children = uniqBy(
      e => e.id,
      getIdAndAddress(parent).flatMap(value => byParent.get(value) ?? []),
    ).filter(e => !seenIds.has(e.id))

    for (const child of children) {
      seenIds.add(child.id)
    }

    return children.map(comment => ({comment, children: build(comment)}))
  }

  const nodes = build(root)

  // A comment can name a parent we don't have, and `comments` is oldest first, so parents come before children.
  for (const comment of comments) {
    if (!seenIds.has(comment.id)) {
      seenIds.add(comment.id)
      nodes.push({comment, children: build(comment)})
    }
  }

  return sortBy(node => node.comment.created_at, nodes)
}

// Loading: where a note lives, and the stores a page reads it and its conversation from.

export class Notes {
  constructor(private readonly app: IApp) {}

  relays = (ref: IEventRef) =>
    this.app.use(Router).resolver.relays(new EventRef(ref).getRelaySelections())

  load = async (ref: IEventRef) => {
    const eventRef = new EventRef(ref)
    const idOrAddress = eventRef.getIdOrAddress()

    if (idOrAddress) {
      return (
        this.app.repository.getEvent(idOrAddress) ??
        first(
          await this.app.use(Network).load({
            relays: await this.relays(ref),
            filters: eventRef.getFilters(),
            timeout: 3000,
          }),
        )
      )
    }
  }

  // A pointer carrying no hints would never resolve, so the load beside it asks the author's relays.
  deriveEvent = (ref: IEventRef) => {
    const idOrAddress = new EventRef(ref).getIdOrAddress()

    this.load(ref)

    return idOrAddress
      ? this.app.use(Events).one(idOrAddress, ref.relays ?? []).$
      : readable<Maybe<TrustedEvent>>(undefined)
  }

  // The filters reach past direct replies, so the tree is built from what hangs off the note.
  deriveReplies = (event: TrustedEvent) =>
    readable<CommentNode[]>([], set => {
      const filters = getThreadFilters(event)
      const controller = new AbortController()

      this.relays(event).then(relays =>
        this.app.use(Network).request({relays, filters, signal: controller.signal}),
      )

      const unsubscribe = this.app
        .use(Events)
        .asc(filters)
        .$.subscribe($events => set(buildCommentTree(event, getDescendants(event, $events))))

      return () => {
        controller.abort()
        unsubscribe()
      }
    })
}

export const notes = usePlugin(Notes)
