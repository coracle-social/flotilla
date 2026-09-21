import {derived} from "svelte/store"
import {noop, pushToMapKey, removeUndefined, shuffle, sortBy, uniqBy} from "@welshman/lib"
import {
  COMMENT,
  addressTags,
  getAddress,
  getIdAndAddress,
  hexTags,
  tagSpec,
  tagValues,
  topicTags,
} from "@welshman/util"
import type {TrustedEvent} from "@welshman/util"
import {withGetter} from "@welshman/store"
import {displayPubkey, getCommentTagValues, getReplyTagValues} from "@welshman/domain"
import {FollowLists, MuteLists, Profiles} from "@welshman/app"
import {deriveUserItem, fromApp, profiles, user} from "@app/core"
import {DEFAULT_PUBKEYS} from "@app/env"

const profileIndex = fromApp($app => $app.use(Profiles).index.$)

export const deriveDisplaysByPubkey = (pubkeys: string[], url?: string) => {
  const relays = removeUndefined([url])

  // Load profiles
  for (const pubkey of pubkeys) {
    if (pubkey) {
      profiles.get().load(pubkey, relays).catch(noop)
    }
  }

  return derived(
    profileIndex,
    $index =>
      new Map(
        pubkeys.map(pubkey => [
          pubkey,
          pubkey ? ($index.get(pubkey)?.display() ?? displayPubkey(pubkey)) : "",
        ]),
      ),
    new Map<string, string>(),
  )
}

export const bootstrapPubkeys = derived(deriveUserItem(FollowLists), $userFollowList => {
  const appPubkeys = DEFAULT_PUBKEYS.split(",")
  const userPubkeys = shuffle($userFollowList?.pubkeys() ?? [])

  return userPubkeys.length > 5 ? userPubkeys : [...userPubkeys, ...appPubkeys]
})

// Ids and addresses of an event's immediate parents, falling back to its thread roots.
const getParents = ({kind, tags}: TrustedEvent) => {
  const {roots, replies} = kind === COMMENT ? getCommentTagValues(tags) : getReplyTagValues(tags)

  return replies.length > 0 ? replies : roots
}

export type CommentNode = {
  comment: TrustedEvent
  children: CommentNode[]
}

export const buildCommentTree = (root: TrustedEvent, comments: TrustedEvent[]) => {
  const byParent = new Map<string, TrustedEvent[]>()

  // A comment names its parent by id, and by address too when the parent is addressable, so
  // index it under every value it gives and dedupe on the way back out.
  for (const comment of comments) {
    for (const parent of getParents(comment)) {
      pushToMapKey(byParent, parent, comment)
    }
  }

  // Nothing stops a comment from naming several parents, which would let the tree cycle, so
  // walk down from the root and keep each comment at the first place it turns up.
  const seen = new Set<string>()

  const build = (parent: TrustedEvent): CommentNode[] => {
    const children = uniqBy(
      e => e.id,
      getIdAndAddress(parent).flatMap(value => byParent.get(value) ?? []),
    ).filter(e => !seen.has(e.id))

    for (const child of children) {
      seen.add(child.id)
    }

    return children.map(comment => ({comment, children: build(comment)}))
  }

  const nodes = build(root)

  // A comment can name a parent we don't have — a superseded version of an addressable root,
  // or a parent that failed to load — so adopt whatever's left rather than dropping it.
  // `comments` is oldest first, so a parent is always adopted before its own children.
  for (const comment of comments) {
    if (!seen.has(comment.id)) {
      seen.add(comment.id)
      nodes.push({comment, children: build(comment)})
    }
  }

  return sortBy(node => node.comment.created_at, nodes)
}

export const isEventMuted = withGetter(
  derived([user, deriveUserItem(MuteLists)], ([$user, $muteList]) => {
    const tags = $muteList?.tags() ?? []
    const mutedEvents = new Set(tagValues(hexTags("e"), tags))
    const mutedPubkeys = new Set(tagValues(hexTags("p"), tags))
    const mutedAddresses = new Set(tagValues(addressTags("a"), tags))
    const mutedTopics = new Set(tagValues(topicTags("t"), tags))
    const mutedWords = tagValues(tagSpec("word"), tags)
    const regex =
      mutedWords.length > 0
        ? new RegExp(`\\b(${mutedWords.map(w => w.toLowerCase().trim()).join("|")})\\b`)
        : undefined

    return (e: TrustedEvent) => {
      if (!$muteList) {
        return false
      }
      if ($user.pubkey === e.pubkey) {
        return false
      }
      if (mutedPubkeys.has(e.pubkey)) {
        return true
      }
      if (mutedEvents.has(e.id)) {
        return true
      }
      if (mutedAddresses.has(getAddress(e))) {
        return true
      }
      if (getParents(e).some(v => mutedEvents.has(v) || mutedAddresses.has(v))) {
        return true
      }
      if (tagValues(topicTags("t"), e.tags).some(t => mutedTopics.has(t))) {
        return true
      }

      if (regex) {
        const profile = profiles.get().get(e.pubkey)

        if (profile?.display().toLowerCase().match(regex)) {
          return true
        }
        if (profile?.nip05()?.match(regex)) {
          return true
        }
      }

      return false
    }
  }),
)
