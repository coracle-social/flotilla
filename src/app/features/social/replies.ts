import {call, pushToMapKey, removeUndefined, sortBy, uniq, uniqBy} from "@welshman/lib"
import {
  COMMENT,
  NOTE,
  getCommentFiltersForRoot,
  getIdAndAddress,
  hexTags,
  tagValues,
} from "@welshman/util"
import type {TrustedEvent} from "@welshman/util"
import {Comment, Note} from "@welshman/domain"
import {reader} from "@app/core/domain"

// The shape of a conversation, read off tags alone.

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
