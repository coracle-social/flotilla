import {nwc} from "@getalby/sdk"
import * as nip19 from "nostr-tools/nip19"
import {get} from "svelte/store"
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
  APP_DATA,
  isSignedEvent,
  makeEvent,
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
  signer,
  session,
  repository,
  publishThunk,
  profilesByPubkey,
  tagEvent,
  tagEventForReaction,
  userRelaySelections,
  userInboxRelaySelections,
  nip44EncryptToSelf,
  loadRelay,
  dropSession,
  tagEventForComment,
  tagEventForQuote,
  waitForThunkError,
  getPubkeyRelays,
  userBlossomServers,
} from "@welshman/app"
import {compressFile} from "@src/lib/html"
import type {SettingsValues, Alert} from "@app/core/state"
import {
  SETTINGS,
  PROTECTED,
  userMembership,
  INDEXER_RELAYS,
  NOTIFIER_PUBKEY,
  NOTIFIER_RELAY,
  DEFAULT_BLOSSOM_SERVERS,
  userRoomsByUrl,
  userSettingsValues,
  canDecrypt,
  ensureUnwrapped,
  userInboxRelays,
  getMembershipUrls,
} from "@app/core/state"
import {loadAlertStatuses} from "@app/core/requests"
import {platform, platformName, getPushInfo} from "@app/util/push"
import {preferencesStorageProvider, Collection} from "@src/lib/storage"

// Utils

export const getPubkeyHints = (pubkey: string) => {
  const relays = getPubkeyRelays(pubkey, RelayMode.Write)
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

  localStorage.clear()

  await preferencesStorageProvider.clear()
  await Collection.clearAll()
}

// Synchronization

export const broadcastUserData = async (relays: string[]) => {
  const authors = [pubkey.get()!]
  const kinds = [RELAYS, INBOX_RELAYS, FOLLOWS, PROFILE]
  const events = repository.query([{kinds, authors}])

  for (const event of events) {
    if (isSignedEvent(event)) {
      await publishThunk({event, relays}).complete
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

export const attemptAuth = async (url: string) => {
  const socket = Pool.get().get(url)

  await socket.auth.attemptAuth(e => signer.get()?.sign(e))
}

export const canEnforceNip70 = async (url: string) => {
  const socket = Pool.get().get(url)

  await socket.auth.attemptAuth(e => signer.get()?.sign(e))

  return socket.auth.status !== AuthStatus.None
}

export const checkRelayAccess = async (url: string, claim = "") => {
  const socket = Pool.get().get(url)

  await attemptAuth(url)

  const thunk = publishJoinRequest({url, claim})
  const error = await waitForThunkError(thunk)

  if (error) {
    const message =
      socket.auth.details?.replace(/^\w+: /, "") ||
      error.replace(/^\w+: /, "") ||
      "join request rejected"

    // If it's a strict NIP 29 relay don't worry about requesting access
    // TODO: remove this if relay29 ever gets less strict
    if (message === "missing group (`h`) tag") return

    // Ignore messages about the relay ignoring ours
    if (error?.startsWith("mute: ")) return

    // Ignore rejected empty claims
    if (!claim && error?.includes("invite code")) return

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

export const checkRelayAuth = async (url: string) => {
  const socket = Pool.get().get(url)
  const okStatuses = [AuthStatus.None, AuthStatus.Ok]

  await attemptAuth(url)

  // Only raise an error if it's not a timeout.
  // If it is, odds are the problem is with our signer, not the relay
  if (!okStatuses.includes(socket.auth.status)) {
    if (socket.auth.details) {
      return `Failed to authenticate (${socket.auth.details})`
    } else {
      return `Failed to authenticate (${last(socket.auth.status.split(":"))})`
    }
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
  await attemptAuth(NOTIFIER_RELAY)

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
  if (!get(canDecrypt)) {
    enableGiftWraps()
  }

  return createAlert({
    description: `for direct messages.`,
    feed: makeIntersectionFeed(
      feedFromFilters([{kinds: [WRAP], "#p": [pubkey.get()!]}]),
      makeRelayFeed(...get(userInboxRelays)),
    ),
  })
}

// Settings

export const makeSettings = async (params: Partial<SettingsValues>) => {
  const json = JSON.stringify({...userSettingsValues.get(), ...params})
  const content = await signer.get().nip44.encrypt(pubkey.get()!, json)
  const tags = [["d", SETTINGS]]

  return makeEvent(APP_DATA, {content, tags})
}

export const publishSettings = async (params: Partial<SettingsValues>) =>
  publishThunk({event: await makeSettings(params), relays: Router.get().FromUser().getUrls()})

export const addTrustedRelay = async (url: string) =>
  publishSettings({trusted_relays: append(url, userSettingsValues.get().trusted_relays)})

export const removeTrustedRelay = async (url: string) =>
  publishSettings({trusted_relays: remove(url, userSettingsValues.get().trusted_relays)})

// Join request

export type JoinRequestParams = {
  url: string
  claim: string
}

export const makeJoinRequest = (params: JoinRequestParams) =>
  makeEvent(AUTH_JOIN, {tags: [["claim", params.claim]]})

export const publishJoinRequest = (params: JoinRequestParams) =>
  publishThunk({event: makeJoinRequest(params), relays: [params.url]})

// Lightning

export const getWebLn = () => (window as any).webln

export const payInvoice = async (invoice: string) => {
  const $session = session.get()

  if (!$session?.wallet) {
    throw new Error("No wallet is connected")
  }

  if ($session.wallet.type === "nwc") {
    return new nwc.NWCClient($session.wallet.info).payInvoice({invoice})
  } else if ($session.wallet.type === "webln") {
    return getWebLn()
      .enable()
      .then(() => getWebLn().sendPayment(invoice))
  }
}

// Gift Wraps

export const enableGiftWraps = () => {
  canDecrypt.set(true)

  for (const event of repository.query([{kinds: [WRAP]}])) {
    ensureUnwrapped(event)
  }
}

// File upload

export const normalizeBlossomUrl = (url: string) => normalizeUrl(url.replace(/^ws/, "http"))

export const hasBlossomSupport = simpleCache(async ([url]: [string]) => {
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
})

export type GetBlossomServerOptions = {
  url?: string
}

export const getBlossomServer = async (options: GetBlossomServerOptions = {}) => {
  if (options.url) {
    if (await hasBlossomSupport(options.url)) {
      return normalizeBlossomUrl(options.url)
    }
  }

  const userUrls = getTagValues("server", getListTags(userBlossomServers.get()))

  for (const url of userUrls) {
    return normalizeBlossomUrl(url)
  }

  return first(DEFAULT_BLOSSOM_SERVERS)!
}

export type UploadFileOptions = {
  url?: string
  encrypt?: boolean
}

export type UploadFileResult = {
  error?: string
  result?: UploadTask
}

export const uploadFile = async (file: File, options: UploadFileOptions = {}) => {
  try {
    const {name, type} = file

    if (!type.match("image/(webp|gif)")) {
      file = await compressFile(file)
    }

    const tags: string[][] = []

    if (options.encrypt) {
      const {ciphertext, key, nonce, algorithm} = await encryptFile(file)

      tags.push(
        ["decryption-key", key],
        ["decryption-nonce", nonce],
        ["encryption-algorithm", algorithm],
      )

      file = new File([new Blob([ciphertext])], name, {
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
      return {error: text}
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
  const scenarios = [router.FromRelays(getMembershipUrls(userMembership.get()))]

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
