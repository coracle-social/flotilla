import * as nip19 from "nostr-tools/nip19"
import {get} from "svelte/store"
import {randomId, flatten, poll, uniq, equals, TIMEZONE, LOCALE} from "@welshman/lib"
import type {Feed} from "@welshman/feeds"
import type {TrustedEvent, EventContent} from "@welshman/util"
import {
  DELETE,
  REPORT,
  PROFILE,
  INBOX_RELAYS,
  RELAYS,
  FOLLOWS,
  REACTION,
  AUTH_JOIN,
  ROOMS,
  COMMENT,
  ALERT_EMAIL,
  ALERT_WEB,
  ALERT_IOS,
  ALERT_ANDROID,
  isSignedEvent,
  makeEvent,
  getAddress,
  displayProfile,
  normalizeRelayUrl,
  makeList,
  addToListPublicly,
  removeFromListByPredicate,
  getTag,
  getListTags,
  getRelayTags,
  getRelayTagValues,
  toNostrURI,
  getRelaysFromList,
  RelayMode,
} from "@welshman/util"
import {Pool, AuthStatus, SocketStatus} from "@welshman/net"
import {Router} from "@welshman/router"
import {
  pubkey,
  signer,
  repository,
  publishThunk,
  profilesByPubkey,
  relaySelectionsByPubkey,
  tagEvent,
  tagEventForReaction,
  userRelaySelections,
  userInboxRelaySelections,
  nip44EncryptToSelf,
  loadRelay,
  clearStorage,
  dropSession,
  tagEventForComment,
  tagEventForQuote,
  getThunkError,
} from "@welshman/app"
import {
  PROTECTED,
  userMembership,
  INDEXER_RELAYS,
  NOTIFIER_PUBKEY,
  NOTIFIER_RELAY,
  userRoomsByUrl,
  deviceAlertAddresses,
} from "@app/state"

// Utils

export const getPubkeyHints = (pubkey: string) => {
  const selections = relaySelectionsByPubkey.get().get(pubkey)
  const relays = selections ? getRelaysFromList(selections, RelayMode.Write) : []
  const hints = relays.length ? relays : INDEXER_RELAYS

  return hints
}

export const getPubkeyPetname = (pubkey: string) => {
  const profile = profilesByPubkey.get().get(pubkey)
  const display = displayProfile(profile)

  return display
}

export const prependParent = (parent: TrustedEvent | undefined, {content, tags}: EventContent) => {
  if (parent) {
    const nevent = nip19.neventEncode({
      id: parent.id,
      kind: parent.kind,
      author: parent.pubkey,
      relays: Router.get().Event(parent).limit(3).getUrls(),
    })

    tags = [...tags, tagEventForQuote(parent)]
    content = toNostrURI(nevent) + "\n\n" + content
  }

  return {content, tags}
}

// Log out

export const logout = async () => {
  const $pubkey = pubkey.get()

  if ($pubkey) {
    dropSession($pubkey)
  }

  await clearStorage()

  localStorage.clear()
}

// Synchronization

export const broadcastUserData = async (relays: string[]) => {
  const authors = [pubkey.get()!]
  const kinds = [RELAYS, INBOX_RELAYS, FOLLOWS, PROFILE]
  const events = repository.query([{kinds, authors}])

  for (const event of events) {
    if (isSignedEvent(event)) {
      await publishThunk({event, relays}).result
    }
  }
}

// List updates

export const addSpaceMembership = async (url: string) => {
  const list = get(userMembership) || makeList({kind: ROOMS})
  const event = await addToListPublicly(list, ["r", url]).reconcile(nip44EncryptToSelf)
  const relays = uniq([...Router.get().FromUser().getUrls(), ...getRelayTagValues(event.tags)])

  return publishThunk({event, relays})
}

export const removeSpaceMembership = async (url: string) => {
  const list = get(userMembership) || makeList({kind: ROOMS})
  const pred = (t: string[]) => t[t[0] === "r" ? 1 : 2] === url
  const event = await removeFromListByPredicate(list, pred).reconcile(nip44EncryptToSelf)
  const relays = uniq([url, ...Router.get().FromUser().getUrls(), ...getRelayTagValues(event.tags)])

  return publishThunk({event, relays})
}

export const addRoomMembership = async (url: string, room: string) => {
  const list = get(userMembership) || makeList({kind: ROOMS})
  const newTags = [
    ["r", url],
    ["group", room, url],
  ]
  const event = await addToListPublicly(list, ...newTags).reconcile(nip44EncryptToSelf)
  const relays = uniq([...Router.get().FromUser().getUrls(), ...getRelayTagValues(event.tags)])

  return publishThunk({event, relays})
}

export const removeRoomMembership = async (url: string, room: string) => {
  const list = get(userMembership) || makeList({kind: ROOMS})
  const pred = (t: string[]) => equals(["group", room, url], t.slice(0, 3))
  const event = await removeFromListByPredicate(list, pred).reconcile(nip44EncryptToSelf)
  const relays = uniq([url, ...Router.get().FromUser().getUrls(), ...getRelayTagValues(event.tags)])

  return publishThunk({event, relays})
}

export const setRelayPolicy = (url: string, read: boolean, write: boolean) => {
  const list = get(userRelaySelections) || makeList({kind: RELAYS})
  const tags = getRelayTags(getListTags(list)).filter(t => normalizeRelayUrl(t[1]) !== url)

  if (read && write) {
    tags.push(["r", url])
  } else if (read) {
    tags.push(["r", url, "read"])
  } else if (write) {
    tags.push(["r", url, "write"])
  }

  return publishThunk({
    event: makeEvent(list.kind, {tags}),
    relays: [
      url,
      ...INDEXER_RELAYS,
      ...Router.get().FromUser().getUrls(),
      ...userRoomsByUrl.get().keys(),
    ],
  })
}

export const setInboxRelayPolicy = (url: string, enabled: boolean) => {
  const list = get(userInboxRelaySelections) || makeList({kind: INBOX_RELAYS})

  // Only update inbox policies if they already exist or we're adding them
  if (enabled || getRelaysFromList(list).includes(url)) {
    const tags = getRelayTags(getListTags(list)).filter(t => normalizeRelayUrl(t[1]) !== url)

    if (enabled) {
      tags.push(["relay", url])
    }

    return publishThunk({
      event: makeEvent(list.kind, {tags}),
      relays: [
        ...INDEXER_RELAYS,
        ...Router.get().FromUser().getUrls(),
        ...userRoomsByUrl.get().keys(),
      ],
    })
  }
}

// Relay access

export const attemptAuth = (url: string) =>
  Pool.get()
    .get(url)
    .auth.attemptAuth(e => signer.get()?.sign(e))

export const checkRelayAccess = async (url: string, claim = "") => {
  const socket = Pool.get().get(url)

  await attemptAuth(url)

  const thunk = publishThunk({
    event: makeEvent(AUTH_JOIN, {tags: [["claim", claim]]}),
    relays: [url],
  })

  const error = await getThunkError(thunk)

  if (error) {
    const message =
      socket.auth.details?.replace(/^\w+: /, "") ||
      error?.replace(/^\w+: /, "") ||
      "join request rejected"

    // If it's a strict NIP 29 relay don't worry about requesting access
    // TODO: remove this if relay29 ever gets less strict
    if (message === "missing group (`h`) tag") return

    // Ignore messages about the relay ignoring ours
    if (error?.startsWith("mute: ")) return

    // Ignore rejected empty claims
    if (!claim && error?.includes("invite code")) {
      return `failed to request access to relay`
    }

    return message
  }
}

export const checkRelayProfile = async (url: string) => {
  const relay = await loadRelay(url)

  if (!relay?.profile) {
    return "Sorry, we weren't able to find that relay."
  }
}

export const checkRelayConnection = async (url: string) => {
  const socket = Pool.get().get(url)

  socket.attemptToOpen()

  await poll({
    signal: AbortSignal.timeout(3000),
    condition: () => socket.status === SocketStatus.Open,
  })

  if (socket.status !== SocketStatus.Open) {
    return `Failed to connect`
  }
}

export const checkRelayAuth = async (url: string, timeout = 3000) => {
  const socket = Pool.get().get(url)
  const okStatuses = [AuthStatus.None, AuthStatus.Ok]

  await attemptAuth(url)

  // Only raise an error if it's not a timeout.
  // If it is, odds are the problem is with our signer, not the relay
  if (!okStatuses.includes(socket.auth.status) && socket.auth.details) {
    return `Failed to authenticate (${socket.auth.details})`
  }
}

export const attemptRelayAccess = async (url: string, claim = "") => {
  const checks = [
    () => checkRelayConnection(url),
    () => checkRelayAccess(url, claim),
    () => checkRelayAuth(url),
  ]

  for (const check of checks) {
    const error = await check()

    if (error) {
      return error
    }
  }
}

// Actions

export const makeDelete = ({event, tags = []}: {event: TrustedEvent; tags?: string[][]}) => {
  const thisTags = [["k", String(event.kind)], ...tagEvent(event), ...tags]
  const groupTag = getTag("h", event.tags)

  if (groupTag) {
    thisTags.push(PROTECTED, groupTag)
  }

  return makeEvent(DELETE, {tags: thisTags})
}

export const publishDelete = ({
  relays,
  event,
  tags = [],
}: {
  relays: string[]
  event: TrustedEvent
  tags?: string[][]
}) => publishThunk({event: makeDelete({event, tags}), relays})

export type ReportParams = {
  event: TrustedEvent
  content: string
  reason: string
}

export const makeReport = ({event, reason, content}: ReportParams) => {
  const tags = [
    ["p", event.pubkey],
    ["e", event.id, reason],
  ]

  return makeEvent(REPORT, {content, tags})
}

export const publishReport = ({
  relays,
  event,
  reason,
  content,
}: ReportParams & {relays: string[]}) =>
  publishThunk({event: makeReport({event, reason, content}), relays})

export type ReactionParams = {
  event: TrustedEvent
  content: string
  tags?: string[][]
}

export const makeReaction = ({content, event, tags: paramTags = []}: ReactionParams) => {
  const tags = [...paramTags, ...tagEventForReaction(event)]

  const groupTag = getTag("h", event.tags)

  if (groupTag) {
    tags.push(PROTECTED)
    tags.push(groupTag)
  }

  return makeEvent(REACTION, {content, tags})
}

export const publishReaction = ({relays, ...params}: ReactionParams & {relays: string[]}) =>
  publishThunk({event: makeReaction(params), relays})

export type CommentParams = {
  event: TrustedEvent
  content: string
  tags?: string[][]
}

export const makeComment = ({event, content, tags = []}: CommentParams) =>
  makeEvent(COMMENT, {content, tags: [...tags, ...tagEventForComment(event)]})

export const publishComment = ({relays, ...params}: CommentParams & {relays: string[]}) =>
  publishThunk({event: makeComment(params), relays})

export type AlertParams = {
  feed: Feed
  description: string
  claims: Record<string, string>
  email?: {
    cron: string
    email: string
    handler: string[]
  }
  web?: {
    endpoint: string
    p256dh: string
    auth: string
  }
  ios?: {
    device_token: string
    bundle_identifier: string
  }
  android?: {
    device_token: string
  }
}

export const makeAlert = async (params: AlertParams) => {
  const tags = [
    ["feed", JSON.stringify(params.feed)],
    ["locale", LOCALE],
    ["timezone", TIMEZONE],
    ["description", params.description],
  ]

  for (const [relay, claim] of Object.entries(params.claims)) {
    tags.push(["claim", relay, claim])
  }

  let kind: number
  if (params.email) {
    kind = ALERT_EMAIL
    tags.push(...Object.entries(params.email).map(flatten))
  } else if (params.web) {
    kind = ALERT_WEB
    tags.push(...Object.entries(params.web).map(flatten))
  } else if (params.ios) {
    kind = ALERT_IOS
    tags.push(...Object.entries(params.ios).map(flatten))
  } else if (params.android) {
    kind = ALERT_ANDROID
    tags.push(...Object.entries(params.android).map(flatten))
  } else {
    throw new Error("Alert has invalid params")
  }

  return makeEvent(kind, {
    content: await signer.get().nip44.encrypt(NOTIFIER_PUBKEY, JSON.stringify(tags)),
    tags: [
      ["d", randomId()],
      ["p", NOTIFIER_PUBKEY],
    ],
  })
}

export const publishAlert = async (params: AlertParams) => {
  const event = await signer.get().sign(await makeAlert(params))

  deviceAlertAddresses.update($addresses => [...$addresses, getAddress(event)])

  return publishThunk({event, relays: [NOTIFIER_RELAY]})
}
