import {derived, readable, writable} from "svelte/store"
import {MINUTE, ago, dissoc, ms, noop, now, sleep, uniq} from "@welshman/lib"
import type {Maybe} from "@welshman/lib"
import type {Relay, RelayFee} from "@welshman/domain"
import {
  normalizeRelayUrl,
  RELAY_ADD_MEMBER,
  RELAY_MEMBERS,
  RELAY_REMOVE_MEMBER,
} from "@welshman/util"
import {Relays, RelayMemberLists, User} from "@welshman/app"
import {synced, withGetter} from "@welshman/store"
import {app, fromApp} from "@app/core/app"
import {authenticate, visitRelay} from "@app/core/auth"
import {relayMemberLists, relays, roomLists} from "@app/core/plugins"
import {RelayAccessStatus, deriveRelayAccess} from "@app/core/relays"
import type {RelayAccess} from "@app/core/relays"
import {kv} from "@app/core/storage"
import {pullAndListen} from "@app/core/sync"
import {userSpaceUrls} from "@app/core/user"
import {getRelayFee} from "@app/tools/spaces/fees"
import type {JoinRefusal} from "@app/tools/spaces/refusal"

export type SpaceDocument =
  | {state: "loading"}
  | {state: "unavailable"}
  | {
      state: "served"
      rooms: boolean
      checkout: Maybe<string>
      fee: Maybe<RelayFee>
      movedTo: Maybe<string>
    }

// What a relay requires of someone who wants to use it as a space.
export type SpacePolicy = {
  charges: boolean
  refusal: Maybe<JoinRefusal>
  document: SpaceDocument
}

// Where the user stands with a space.
export type SpaceStanding =
  | {stage: "checking"}
  | {stage: "outside"}
  | {stage: "joined"}
  | {stage: "unlisted"}
  | {stage: "refused"; reason: string}

// The one thing a space page shows or asks for next.
export type SpaceStep =
  | {step: "checking"}
  | {step: "moved"; url: string}
  | {step: "refused"; reason: string}
  | {step: "unreachable"; reason: "down" | "silent"}
  | {step: "untrusted"}
  | {step: "add"; paid: boolean}
  | {step: "waiting"; since: number}
  | {step: "pay"; checkout: Maybe<string>; fee: Maybe<RelayFee>}
  | {step: "join"; invite: boolean}
  | {step: "open"}

export type SpaceInput = "document" | "membership" | "spaceList"

export type PendingCheckout = {pubkey: string; at: number}

// Which of a space's loads have answered, since an empty store can't tell "not yet" from "never".
const settledInputs = writable<Record<string, SpaceInput[]>>({})

// How each space last answered a join, which is the only place some of its rules are stated.
export const joinRefusals = writable<Record<string, JoinRefusal>>({})

// The step each space last prompted for this session, so a dismissed prompt stays dismissed.
export const promptedSteps = new Map<string, SpaceStep["step"]>()

// A checkout's return trip is a page load, so the record has to outlive the page.
export const pendingCheckouts = withGetter(
  synced<Record<string, PendingCheckout>>({
    key: "pendingCheckouts",
    defaultValue: {},
    storage: kv,
  }),
)

// The page leaves for the payment page right after this, so the record is written before it goes.
export const savePendingCheckout = async (url: string, pubkey: string) => {
  const $checkouts = {...pendingCheckouts.get(), [url]: {pubkey, at: now()}}

  pendingCheckouts.set($checkouts)

  await kv.set("pendingCheckouts", $checkouts)
}

export const getPendingCheckout = (
  $checkouts: Record<string, PendingCheckout>,
  url: string,
  pubkey: Maybe<string>,
) => {
  const checkout = $checkouts[url]

  if (checkout && checkout.pubkey === pubkey && checkout.at > ago(10, MINUTE)) {
    return checkout
  }
}

// A space whose document hasn't answered may still have rooms, so only a served document rules them out.
export const hasRooms = (relay: Maybe<Relay>) => !relay || relay.hasNip(29)

const markSettled = (url: string, input: SpaceInput) =>
  settledInputs.update($inputs => ({...$inputs, [url]: uniq([...($inputs[url] ?? []), input])}))

// Each input gets eight seconds to answer, after which the space stops waiting for it.
const settle = (url: string, input: SpaceInput, load: Promise<unknown>) =>
  Promise.race([load.catch(noop), sleep(ms(8))]).then(() => markSettled(url, input))

// Asks again for everything a space's step depends on.
export const refreshSpace = (url: string) => {
  const {pubkey} = User.require(app.get())

  settle(url, "document", relays.get().forceLoad(url))
  settle(url, "membership", relayMemberLists.get().forceLoad(url))
  settle(url, "spaceList", roomLists.get().forceLoad(pubkey, [url]))
}

// Visiting a space identifies to it and loads what its step depends on, until the page unmounts.
export const loadSpace = (url: string) => {
  authenticate(url)
  refreshSpace(url)

  return visitRelay(url)
}

// Forgets what this session learned about a space, as when the user leaves it.
export const forgetSpace = (url: string) => {
  joinRefusals.update(dissoc(url))
  promptedSteps.delete(url)
}

export const clearSpaceModel = () => {
  settledInputs.set({})
  joinRefusals.set({})
  promptedSteps.clear()
}

export const syncSpaceMembership = (url: string) => {
  const $pubkey = app.get().user?.pubkey

  return pullAndListen(url, [
    {kinds: [RELAY_MEMBERS]},
    ...($pubkey
      ? [
          {kinds: [RELAY_ADD_MEMBER], "#p": [$pubkey], limit: 1},
          {kinds: [RELAY_REMOVE_MEMBER], "#p": [$pubkey], limit: 1},
        ]
      : []),
  ])
}

export const derivePubkeyIsSpaceMember = (url: string, pubkey: string) =>
  derived(
    fromApp($app => $app.use(RelayMemberLists).forUrl(url)),
    $members => Boolean($members?.isMember(pubkey)),
  )

export const deriveUserIsSpaceMember = (url: string) =>
  fromApp($app => ($app.user ? derivePubkeyIsSpaceMember(url, $app.user.pubkey) : readable(false)))

const getSpaceDocument = (relay: Maybe<Relay>, settled: SpaceInput[]): SpaceDocument => {
  if (relay) {
    return {
      state: "served",
      rooms: relay.hasNip(29),
      checkout: relay.payments_url,
      fee: getRelayFee(relay),
      movedTo: relay.redirect_to
        ? normalizeRelayUrl(relay.redirect_to.replace(/^http/, "ws"))
        : undefined,
    }
  }

  return settled.includes("document") ? {state: "unavailable"} : {state: "loading"}
}

export const deriveSpacePolicy = (url: string) =>
  derived(
    [fromApp($app => $app.use(Relays).one(url)), joinRefusals, settledInputs],
    ([$relay, $joinRefusals, $settledInputs]): SpacePolicy => {
      const refusal = $joinRefusals[url]

      return {
        charges: Boolean($relay?.limitation?.payment_required) || refusal?.kind === "payment",
        refusal,
        document: getSpaceDocument($relay, $settledInputs[url] ?? []),
      }
    },
  )

export const deriveSpaceStanding = (url: string) =>
  derived(
    [userSpaceUrls, deriveUserIsSpaceMember(url), deriveRelayAccess(url), settledInputs],
    ([$userSpaceUrls, $isMember, $access, $settledInputs]): SpaceStanding => {
      const settled = $settledInputs[url] ?? []

      if ($userSpaceUrls.includes(url)) {
        // Only a member's refused reads are about them; a stranger's are how a closed relay says no.
        return $access.status === RelayAccessStatus.Denied
          ? {stage: "refused", reason: $access.reason}
          : {stage: "joined"}
      }

      // A relay's member list says nothing until the user's own list has answered, or a member on a new device looks unlisted.
      if (settled.includes("spaceList") && $isMember) {
        return {stage: "unlisted"}
      }

      if (
        settled.includes("document") &&
        settled.includes("membership") &&
        settled.includes("spaceList")
      ) {
        return {stage: "outside"}
      }

      return {stage: "checking"}
    },
  )

export type SpaceStepInputs = {
  url: string
  policy: SpacePolicy
  standing: SpaceStanding
  access: RelayAccess
  checkout: Maybe<PendingCheckout>
}

// The steps are checked in order, and the order is what rules out showing two at once.
export const getSpaceStep = ({
  url,
  policy,
  standing,
  access,
  checkout,
}: SpaceStepInputs): SpaceStep => {
  const {document, refusal} = policy
  const isJoined = standing.stage === "joined"

  if (document.state === "served" && document.movedTo && document.movedTo !== url) {
    return {step: "moved", url: document.movedTo}
  }

  if (standing.stage === "refused") {
    return {step: "refused", reason: standing.reason}
  }

  if (refusal?.kind === "denied") {
    return {step: "refused", reason: refusal.message}
  }

  if (!isJoined && access.status === RelayAccessStatus.Unreachable) {
    return {step: "unreachable", reason: "down"}
  }

  if (!isJoined && access.status === RelayAccessStatus.Unresponsive) {
    return {step: "unreachable", reason: "silent"}
  }

  if (access.status === RelayAccessStatus.Untrusted) {
    return {step: "untrusted"}
  }

  if (isJoined) {
    return {step: "open"}
  }

  if (standing.stage === "checking" || document.state === "loading") {
    return {step: "checking"}
  }

  if (standing.stage === "unlisted") {
    return {step: "add", paid: Boolean(checkout)}
  }

  if (checkout) {
    return {step: "waiting", since: checkout.at}
  }

  if (policy.charges && document.state === "served") {
    return {step: "pay", checkout: document.checkout, fee: document.fee}
  }

  if (policy.charges) {
    return {step: "pay", checkout: undefined, fee: undefined}
  }

  return {step: "join", invite: refusal?.kind === "claim" || refusal?.kind === "rejected"}
}

export const deriveSpaceStep = (url: string) =>
  derived(
    [
      deriveSpacePolicy(url),
      deriveSpaceStanding(url),
      deriveRelayAccess(url),
      pendingCheckouts,
      app,
    ],
    ([$policy, $standing, $access, $pendingCheckouts, $app]) =>
      getSpaceStep({
        url,
        policy: $policy,
        standing: $standing,
        access: $access,
        checkout: getPendingCheckout($pendingCheckouts, url, $app.user?.pubkey),
      }),
  )
