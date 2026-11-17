import {Note} from "@welshman/domain"
import {pushToMapKey, removeUndefined, sortBy, uniq, uniqBy} from "@welshman/lib"
import {NOTE, getCommentFiltersForRoot, getIdAndAddress} from "@welshman/util"
import type {Filter, TrustedEvent} from "@welshman/util"
import {reader} from "@app/core/domain"
import {getTargetKeys} from "@app/tools/targets"

export const getThreadFilters = (event: TrustedEvent): Filter[] => {
  const rootId = event.kind === NOTE ? reader(Note)(event).root()?.id : undefined

  return [
    ...getCommentFiltersForRoot([event]),
    {kinds: [NOTE], "#e": uniq(removeUndefined([event.id, rootId]))},
  ]
}

export const getDescendants = (root: TrustedEvent, events: TrustedEvent[]) => {
  const keys = new Set(getIdAndAddress(root))
  const descendants: TrustedEvent[] = []

  let added = true

  while (added) {
    added = false

    for (const event of events) {
      if (!keys.has(event.id) && getTargetKeys(event).some(key => keys.has(key))) {
        descendants.push(event)

        for (const key of getIdAndAddress(event)) {
          keys.add(key)
        }

        added = true
      }
    }
  }

  return descendants
}

export type CommentNode = {comment: TrustedEvent; children: CommentNode[]}

export const buildCommentTree = (root: TrustedEvent, comments: TrustedEvent[]): CommentNode[] => {
  const commentsByKey = new Map<string, TrustedEvent[]>()

  for (const comment of comments) {
    for (const key of getTargetKeys(comment)) {
      pushToMapKey(commentsByKey, key, comment)
    }
  }

  // Nothing stops a comment naming several parents, which would let the tree cycle.
  const placed = new Set<string>()

  // Siblings are claimed before any of them is descended into, so a comment stays with its shallowest parent.
  const build = (parent: TrustedEvent): CommentNode[] => {
    const replies = getIdAndAddress(parent).flatMap(key => commentsByKey.get(key) ?? [])
    const children = uniqBy(comment => comment.id, replies).filter(
      comment => !placed.has(comment.id),
    )

    for (const child of children) {
      placed.add(child.id)
    }

    return children.map(comment => ({comment, children: build(comment)}))
  }

  const nodes = build(root)

  for (const comment of comments) {
    if (!placed.has(comment.id)) {
      placed.add(comment.id)
      nodes.push({comment, children: build(comment)})
    }
  }

  return sortBy(node => node.comment.created_at, nodes)
}
