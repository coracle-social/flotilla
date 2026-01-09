import {nwc} from "@getalby/sdk"
import * as nip19 from "nostr-tools/nip19"
import {get, derived} from "svelte/store"
import type {Override, MakeOptional} from "@welshman/lib"
import {
  first,
  sha256,
  randomId,
  append,
  remove,
  flatten,
  poll,
  uniq,
  equals,
  TIMEZONE,
  LOCALE,
  parseJson,
  fromPairs,
  last,
  simpleCache,
  normalizeUrl,
  nthNe,
} from "@welshman/lib"
import {decrypt, Nip01Signer} from "@welshman/signer"
import type {UploadTask} from "@welshman/editor"
import type {Feed} from "@welshman/feeds"
import {makeIntersectionFeed, feedFromFilters, makeRelayFeed} from "@welshman/feeds"
import type {TrustedEvent, EventContent, Profile} from "@welshman/util"
import {
  WRAP,
  DELETE,
  REPORT,
  PROFILE,
  MESSAGING_RELAYS,
  RELAYS,
  FOLLOWS,
  REACTION,
  RELAY_JOIN,
  RELAY_LEAVE,
  ROOMS,
  COMMENT,
  ALERT_EMAIL,
  ALERT_WEB,
  ALERT_IOS,
  ALERT_ANDROID,
  APP_DATA,
  isSignedEvent,
  makeEvent,
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
  getAddress,
  getTagValue,
  getTagValues,
  uploadBlob,
  canUploadBlob,
  encryptFile,
  makeBlossomAuthEvent,
  isPublishedProfile,
  editProfile,
  createProfile,
  uniqTags,
} from "@welshman/util"
import {Pool, AuthStatus, SocketStatus} from "@welshman/net"
import {Router} from "@welshman/router"
import {
  pubkey,
  sign,
  signer,
  session,
  repository,
  publishThunk,
  tagEvent,
  tagEventForReaction,
  userRelayList,
  userMessagingRelayList,
  nip44EncryptToSelf,
  dropSession,
  tagEventForComment,
  tagEventForQuote,
  waitForThunkError,
  getPubkeyRelays,
  userBlossomServerList,
  shouldUnwrap,
  getThunkError,
} from "@welshman/app"
import {compressFile} from "@lib/html"
import {kv, db} from "@app/core/storage"
import type {SettingsValues, Alert} from "@app/core/state"
import {
  SETTINGS,
  PROTECTED,
  INDEXER_RELAYS,
  NOTIFIER_PUBKEY,
  NOTIFIER_RELAY,
  DEFAULT_BLOSSOM_SERVERS,
  userSpaceUrls,
  userSettingsValues,
  getSetting,
  userGroupList,
  shouldIgnoreError,
  stripPrefix,
  relaysMostlyRestricted,
  deriveSocket,
} from "@app/core/state"
import {loadAlertStatuses} from "@app/core/requests"
import {platform, platformName, getPushInfo} from "@app/util/push"

// Utils

export const getPubkeyHints = (pubkey: string) => {
  const relays = getPubkeyRelays(pubkey, RelayMode.Write)
  const hints = relays.length ? relays : INDEXER_RELAYS

  return hints
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

  localStorage.clear()

  await kv.clear()
  await db.clear()
}

// Synchronization

export const broadcastUserData = async (relays: string[]) => {
  const authors = [pubkey.get()!]
  const kinds = [RELAYS, MESSAGING_RELAYS, FOLLOWS, PROFILE]
  const events = repository.query([{kinds, authors}])

  for (const event of events) {
    if (isSignedEvent(event)) {
      await publishThunk({event, relays}).complete
    }
  }
}

// List updates

export const addSpaceMembership = async (url: string) => {
  const list = get(userGroupList) || makeList({kind: ROOMS})
  const event = await addToListPublicly(list, ["r", url]).reconcile(nip44EncryptToSelf)
  const relays = uniq([...Router.get().FromUser().getUrls(), ...getRelayTagValues(event.tags)])

  return publishThunk({event, relays})
}

export const removeSpaceMembership = async (url: string) => {
  const list = get(userGroupList) || makeList({kind: ROOMS})
  const pred = (t: string[]) => normalizeRelayUrl(t[t[0] === "r" ? 1 : 2]) === url
  const event = await removeFromListByPredicate(list, pred).reconcile(nip44EncryptToSelf)
  const relays = uniq([url, ...Router.get().FromUser().getUrls(), ...getRelayTagValues(event.tags)])

  return publishThunk({event, relays})
}

export const addRoomMembership = async (url: string, h: string) => {
  const list = get(userGroupList) || makeList({kind: ROOMS})
  const newTags = [
    ["r", url],
    ["group", h, url],
  ]
  const event = await addToListPublicly(list, ...newTags).reconcile(nip44EncryptToSelf)
  const relays = uniq([...Router.get().FromUser().getUrls(), ...getRelayTagValues(event.tags)])

  return publishThunk({event, relays})
}

export const removeRoomMembership = async (url: string, h: string) => {
  const list = get(userGroupList) || makeList({kind: ROOMS})
  const pred = (t: string[]) => equals(["group", h, url], t.slice(0, 3))
  const event = await removeFromListByPredicate(list, pred).reconcile(nip44EncryptToSelf)
  const relays = uniq([url, ...Router.get().FromUser().getUrls(), ...getRelayTagValues(event.tags)])

  return publishThunk({event, relays})
}

export const setRelayPolicy = (url: string, read: boolean, write: boolean) => {
  const list = get(userRelayList) || makeList({kind: RELAYS})
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
    relays: [url, ...INDEXER_RELAYS, ...Router.get().FromUser().getUrls(), ...get(userSpaceUrls)],
  })
}

export const setMessagingRelayPolicy = (url: string, enabled: boolean) => {
  const list = get(userMessagingRelayList) || makeList({kind: MESSAGING_RELAYS})

  // Only update messaging policies if they already exist or we're adding them
  if (enabled || getRelaysFromList(list).includes(url)) {
    const tags = getRelayTags(getListTags(list)).filter(t => normalizeRelayUrl(t[1]) !== url)

    if (enabled) {
      tags.push(["relay", url])
    }

    return publishThunk({
      event: makeEvent(list.kind, {tags}),
      relays: [...INDEXER_RELAYS, ...Router.get().FromUser().getUrls(), ...get(userSpaceUrls)],
    })
  }
}

// Relay access

export const canEnforceNip70 = async (url: string) => {
  const socket = Pool.get().get(url)

  await socket.auth.attemptAuth(sign)

  return socket.auth.status !== AuthStatus.None
}

export const attemptRelayAccess = async (url: string, claim = "") => {
  const socket = Pool.get().get(url)

  socket.attemptToOpen()

  await poll({
    signal: AbortSignal.timeout(3000),
    condition: () => socket.status === SocketStatus.Open,
  })

  if (socket.status !== SocketStatus.Open) {
    return `Failed to connect`
  }

  await socket.auth.attemptAuth(sign)

  // Only raise an error if it's not a timeout.
  // If it is, odds are the problem is with our signer, not the relay
  if (![AuthStatus.None, AuthStatus.Ok].includes(socket.auth.status)) {
    if (socket.auth.details) {
      return `Failed to authenticate (${socket.auth.details})`
    } else {
      return `Failed to authenticate (${last(socket.auth.status.split(":"))})`
    }
  }

  const thunk = publishJoinRequest({url, claim})
  const error = await waitForThunkError(thunk)

  if (shouldIgnoreError(error)) return

  if (error.includes("invite code")) return "join request rejected"

  return stripPrefix(error)
}

export const deriveRelayAuthError = (url: string, claim = "") => {
  // Kick off the auth process
  Pool.get().get(url).auth.attemptAuth(sign)

  // Attempt to join the relay
  const thunk = publishJoinRequest({url, claim})

  return derived(
    [thunk, relaysMostlyRestricted, deriveSocket(url)],
    ([$thunk, $relaysMostlyRestricted, $socket]) => {
      if ($socket.auth.status === AuthStatus.Forbidden && $socket.auth.details) {
        return stripPrefix($socket.auth.details)
      }

      if ($relaysMostlyRestricted[url]) {
        return stripPrefix($relaysMostlyRestricted[url])
      }

      const error = getThunkError($thunk)

      if (error) {
        const isEmptyInvite = !claim && error.includes("invite code")

        if (!shouldIgnoreError(error) && !isEmptyInvite) {
          return stripPrefix(error) || "join request rejected"
        }
      }
    },
  )
}

// Deletions

export type DeleteParams = {
  protect: boolean
  event: TrustedEvent
  tags?: string[][]
}

export const makeDelete = ({protect, event, tags = []}: DeleteParams) => {
  const thisTags = [["k", String(event.kind)], ...tagEvent(event), ...tags]
  const groupTag = getTag("h", event.tags)

  if (groupTag) {
    thisTags.push(groupTag)
  }

  if (protect) {
    thisTags.push(PROTECTED)
  }

  return makeEvent(DELETE, {tags: thisTags})
}

export const publishDelete = ({relays, ...params}: DeleteParams & {relays: string[]}) =>
  publishThunk({event: makeDelete(params), relays})

// Reports

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

// Reactions

export type ReactionParams = {
  protect: boolean
  event: TrustedEvent
  content: string
  tags?: string[][]
}

export const makeReaction = ({protect, content, event, tags: paramTags = []}: ReactionParams) => {
  const tags = [...paramTags, ...tagEventForReaction(event)]
  const groupTag = getTag("h", event.tags)

  if (groupTag) {
    tags.push(groupTag)
  }

  if (protect) {
    tags.push(PROTECTED)
  }

  return makeEvent(REACTION, {content, tags})
}

export const publishReaction = ({relays, ...params}: ReactionParams & {relays: string[]}) =>
  publishThunk({event: makeReaction(params), relays})

// Comments

export type CommentParams = {
  event: TrustedEvent
  content: string
  tags?: string[][]
}

export const makeComment = ({event, content, tags = []}: CommentParams) =>
  makeEvent(COMMENT, {content, tags: [...tags, ...tagEventForComment(event)]})

export const publishComment = ({relays, ...params}: CommentParams & {relays: string[]}) =>
  publishThunk({event: makeComment(params), relays})

// Alerts

export type AlertParamsEmail = {
  cron: string
  email: string
  handler: string[]
}

export type AlertParamsWeb = {
  endpoint: string
  p256dh: string
  auth: string
}

export type AlertParamsIos = {
  device_token: string
  bundle_identifier: string
}

export type AlertParamsAndroid = {
  device_token: string
}

export type AlertParams = {
  feed: Feed
  description: string
  claims?: Record<string, string>
  email?: AlertParamsEmail
  web?: AlertParamsWeb
  ios?: AlertParamsIos
  android?: AlertParamsAndroid
}

export const makeAlert = async (params: AlertParams) => {
  const tags = [
    ["feed", JSON.stringify(params.feed)],
    ["locale", LOCALE],
    ["timezone", TIMEZONE],
    ["description", params.description],
  ]

  for (const [relay, claim] of Object.entries(params.claims || [])) {
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

export const publishAlert = async (params: AlertParams) =>
  publishThunk({event: await makeAlert(params), relays: [NOTIFIER_RELAY]})

export const deleteAlert = (alert: Alert) => {
  const relays = [NOTIFIER_RELAY]
  const tags = [["p", NOTIFIER_PUBKEY]]

  return publishDelete({event: alert.event, relays, tags, protect: false})
}

export type CreateAlertParams = Override<
  AlertParams,
  {
    email?: MakeOptional<AlertParamsEmail, "handler">
  }
>

export type CreateAlertResult = {
  ok?: true
  error?: string
}

export const createAlert = async (params: CreateAlertParams): Promise<CreateAlertResult> => {
  if (params.email) {
    const cadence = params.email.cron.endsWith("1") ? "Weekly" : "Daily"
    const handler = [
      "31990:97c70a44366a6535c145b333f973ea86dfdc2d7a99da618c40c64705ad98e322:1737058597050",
      "wss://relay.nostr.band/",
      "web",
    ]

    params.email = {handler, ...params.email}
    params.description = `${cadence} alert ${params.description}, sent via email.`
  } else {
    try {
      // @ts-ignore
      params[platform] = await getPushInfo()
      params.description = `${platformName} push notification ${params.description}.`
    } catch (e: any) {
      return {error: String(e)}
    }
  }

  // If we don't do this we'll get an event rejection
  await Pool.get().get(NOTIFIER_RELAY).auth.attemptAuth(sign)

  const thunk = await publishAlert(params as AlertParams)
  const error = await waitForThunkError(thunk)

  if (error) {
    return {error}
  }

  // Fetch our new status to make sure it's active
  const $pubkey = pubkey.get()!
  const address = getAddress(thunk.event)
  const statusEvents = await loadAlertStatuses($pubkey!)
  const statusEvent = statusEvents.find(event => getTagValue("d", event.tags) === address)
  const statusTags = statusEvent
    ? parseJson(await decrypt(signer.get(), NOTIFIER_PUBKEY, statusEvent.content))
    : []
  const {status = "error", message = "Your alert was not activated"}: Record<string, string> =
    fromPairs(statusTags)

  if (status === "error") {
    return {error: message}
  }

  return {ok: true}
}

export const createDmAlert = async () => {
  if (!shouldUnwrap.get()) {
    shouldUnwrap.set(true)
  }

  const $pubkey = pubkey.get()!

  return createAlert({
    description: `for direct messages.`,
    feed: makeIntersectionFeed(
      feedFromFilters([{kinds: [WRAP], "#p": [$pubkey]}]),
      makeRelayFeed(...getPubkeyRelays($pubkey, RelayMode.Messaging)),
    ),
  })
}

// Settings

export const makeSettings = async (params: Partial<SettingsValues>) => {
  const json = JSON.stringify({...get(userSettingsValues), ...params})
  const content = await signer.get().nip44.encrypt(pubkey.get()!, json)
  const tags = [["d", SETTINGS]]

  return makeEvent(APP_DATA, {content, tags})
}

export const publishSettings = async (params: Partial<SettingsValues>) =>
  publishThunk({event: await makeSettings(params), relays: Router.get().FromUser().getUrls()})

export const addTrustedRelay = async (url: string) =>
  publishSettings({trusted_relays: append(url, getSetting<string[]>("trusted_relays"))})

export const removeTrustedRelay = async (url: string) =>
  publishSettings({trusted_relays: remove(url, getSetting<string[]>("trusted_relays"))})

// Join request

export type JoinRequestParams = {
  url: string
  claim: string
}

export const makeJoinRequest = (params: JoinRequestParams) =>
  makeEvent(RELAY_JOIN, {tags: [["claim", params.claim]]})

export const publishJoinRequest = (params: JoinRequestParams) =>
  publishThunk({event: makeJoinRequest(params), relays: [params.url]})

// Leave request

export type LeaveRequestParams = {
  url: string
}

export const publishLeaveRequest = (params: LeaveRequestParams) =>
  publishThunk({event: makeEvent(RELAY_LEAVE), relays: [params.url]})

// Lightning

export const getWebLn = () => (window as any).webln

export const payInvoice = async (invoice: string, msats?: number) => {
  const $session = session.get()

  if (!$session?.wallet) {
    throw new Error("No wallet is connected")
  }

  if ($session.wallet.type === "nwc") {
    const params: {invoice: string; amount?: number} = {invoice}
    if (msats) params.amount = msats
    return new nwc.NWCClient($session.wallet.info).payInvoice(params)
  } else if ($session.wallet.type === "webln") {
    if (msats) throw new Error("Unable to pay zero invoices with webln")
    return getWebLn()
      .enable()
      .then(() => getWebLn().sendPayment(invoice))
  }
}

// File upload

export const normalizeBlossomUrl = (url: string) => normalizeUrl(url.replace(/^ws/, "http"))

export const fetchHasBlossomSupport = async (url: string) => {
  const server = normalizeBlossomUrl(url)
  const $signer = signer.get() || Nip01Signer.ephemeral()
  const headers: Record<string, string> = {
    "X-Content-Type": "text/plain",
    "X-Content-Length": "1",
    "X-SHA-256": "73cb3858a687a8494ca3323053016282f3dad39d42cf62ca4e79dda2aac7d9ac",
  }

  try {
    const authEvent = await $signer.sign(makeBlossomAuthEvent({action: "upload", server}))
    const res = await canUploadBlob(server, {authEvent, headers})

    return res.status === 200
  } catch (e) {
    if (!String(e).match(/Failed to fetch|NetworkError/)) {
      console.error(e)
    }
  }

  return false
}

export const hasBlossomSupport = simpleCache(([url]: [string]) => fetchHasBlossomSupport(url))

export type GetBlossomServerOptions = {
  url?: string
}

export const getBlossomServer = async (options: GetBlossomServerOptions = {}) => {
  if (options.url) {
    if (await hasBlossomSupport(options.url)) {
      return normalizeBlossomUrl(options.url)
    }
  }

  const userUrls = getTagValues("server", getListTags(get(userBlossomServerList)))

  for (const url of userUrls) {
    return normalizeBlossomUrl(url)
  }

  return first(DEFAULT_BLOSSOM_SERVERS)!
}

export type UploadFileOptions = {
  url?: string
  encrypt?: boolean
  maxWidth?: number
  maxHeight?: number
}

export type UploadFileResult = {
  error?: string
  result?: UploadTask
}

export const uploadFile = async (file: File, options: UploadFileOptions = {}) => {
  try {
    const {name, type} = file

    if (!type.match("image/(webp|gif|svg)")) {
      file = await compressFile(file, options)
    }

    const tags: string[][] = []

    if (options.encrypt) {
      const {ciphertext, key, nonce, algorithm} = await encryptFile(file)

      tags.push(
        ["decryption-key", key],
        ["decryption-nonce", nonce],
        ["encryption-algorithm", algorithm],
      )

      file = new File([new Uint8Array(ciphertext)], name, {
        type: "application/octet-stream",
      })
    }

    const ext = "." + type.split("/")[1]
    const server = await getBlossomServer(options)
    const hashes = [await sha256(await file.arrayBuffer())]
    const $signer = signer.get() || Nip01Signer.ephemeral()
    const authTemplate = makeBlossomAuthEvent({action: "upload", server, hashes})
    const authEvent = await $signer.sign(authTemplate)
    const res = await uploadBlob(server, file, {authEvent})
    const text = await res.text()

    let {uploaded, url, ...task} = parseJson(text) || {}

    if (!uploaded) {
      return {error: text || `Failed to upload file (HTTP ${res.status})`}
    }

    // Always append correct file extension if we encrypted the file, or if it's missing
    if (options.encrypt) {
      url = url.replace(/\.\w+$/, "") + ext
    } else if (new URL(url).pathname.split(".").length === 1) {
      url += ext
    }

    const result = {...task, tags, url}

    return {result}
  } catch (e: any) {
    console.error("Error caught when uploading file:", e)

    return {error: e.toString()}
  }
}

// Update Profile

export const updateProfile = async ({
  profile,
  shouldBroadcast = !getTag(PROTECTED, profile.event?.tags || []),
}: {
  profile: Profile
  shouldBroadcast?: boolean
}) => {
  const router = Router.get()
  const template = isPublishedProfile(profile) ? editProfile(profile) : createProfile(profile)
  const scenarios = [router.FromRelays(get(userSpaceUrls))]

  if (shouldBroadcast) {
    scenarios.push(router.FromUser(), router.Index())
    template.tags = template.tags.filter(nthNe(0, "-"))
  } else {
    template.tags = uniqTags([...template.tags, PROTECTED])
  }

  const event = makeEvent(template.kind, template)
  const relays = router.merge(scenarios).getUrls()

  await publishThunk({event, relays}).complete
}
