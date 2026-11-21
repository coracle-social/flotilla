import {Capacitor} from "@capacitor/core"
import {get} from "svelte/store"
import {assoc, dissoc} from "@welshman/lib"
import type {Maybe} from "@welshman/lib"
import {relay, FOLLOWS, MESSAGING_RELAYS, RELAYS} from "@welshman/util"
import {AuthStatus} from "@welshman/net"
import {RelayJoin, RelayLeave} from "@welshman/domain"
import {Sync, User, publish} from "@welshman/app"
import {app} from "@app/core/app"
import {authenticate} from "@app/core/auth"
import {relayMemberLists, relays, roomLists} from "@app/core/plugins"
import {command, writer} from "@app/core/domain"
import {PLATFORM_URL} from "@app/core/env"
import {addTrustedRelay, removeTrustedRelay} from "@app/core/settings"
import {syncApplicationData} from "@app/core/sync"
import {userSpaceUrls} from "@app/core/user"
import {optInSpaceNotifications} from "@app/tools/push/actions"
import {publishRoomList} from "@app/tools/publish"
import * as pages from "@app/navigation/pages"
import {
  forgetSpace,
  joinRefusals,
  pendingCheckouts,
  refreshSpace,
  savePendingCheckout,
} from "@app/tools/spaces/model"
import {parseRefusal} from "@app/tools/spaces/refusal"
import type {JoinRefusal} from "@app/tools/spaces/refusal"

// A relay that refused the auth event refused the user; any other failure is the connection's.
const getAuthRefusal = (url: string, message: string): JoinRefusal =>
  app.get().pool.get(url).auth.status === AuthStatus.Forbidden
    ? {kind: "denied", message}
    : parseRefusal(message)

const publishJoin = async (url: string, claim: string): Promise<Maybe<JoinRefusal>> => {
  const eventWriter = writer(RelayJoin).forceRoutes(relay(url))

  if (claim) {
    eventWriter.setClaim(claim)
  }

  const publication = await command(eventWriter).then(publish)
  const error = await publication.getFatalError()

  if (error) {
    return parseRefusal(error)
  }

  // The space's step reads the member list, which the relay has just changed.
  joinRefusals.update(dissoc(url))
  await relayMemberLists.get().forceLoad(url)
}

// Asks a space to list the user, and returns how it refused if it did.
export const requestMembership = async (url: string, claim = "") => {
  const authError = await authenticate(url)

  return authError ? getAuthRefusal(url, authError) : publishJoin(url, claim)
}

// Adds a space that lists the user to their own spaces.
export const addSpace = async (url: string, notifications: boolean) => {
  await optInSpaceNotifications(url, notifications)
  await roomLists.get().addRelay(url).then(publishRoomList)
  syncApplicationData()
  app
    .get()
    .use(Sync)
    .push({
      relays: [url],
      filters: [
        {
          kinds: [RELAYS, MESSAGING_RELAYS, FOLLOWS],
          authors: [User.require(app.get()).pubkey],
        },
      ],
    })
  joinRefusals.update(dissoc(url))
  pendingCheckouts.update(dissoc(url))
}

// A relay that challenges only after refusing the join is answered, and asked once more.
export const joinSpace = async (
  url: string,
  {claim = "", notifications}: {claim?: string; notifications: boolean},
) => {
  const first = await requestMembership(url, claim)
  const refusal = first?.kind === "auth" ? await requestMembership(url, claim) : first

  // A NIP-29 relay holds no space membership, so the user's own list is all joining means there.
  if (refusal && refusal.kind !== "no-membership") {
    joinRefusals.update(assoc(url, refusal))

    return refusal
  }

  await addSpace(url, notifications)
}

export const leaveSpace = async (url: string) => {
  await roomLists.get().removeRelay(url).then(publishRoomList)
  await command(writer(RelayLeave).forceRoutes(relay(url))).then(publish)
  await removeTrustedRelay(url)
  pendingCheckouts.update(dissoc(url))
  forgetSpace(url)
}

// Opens a space's payment page with the pubkey being paid for and where to come back to, or says why it can't.
export const payForSpace = async (url: string) => {
  const paymentsUrl = relays.get().get(url)?.payments_url

  if (paymentsUrl) {
    const {pubkey} = User.require(app.get())
    // A payment page comes back to the app by universal link on native.
    const origin = Capacitor.isNativePlatform() ? PLATFORM_URL : location.origin
    const checkoutUrl = new URL(paymentsUrl)

    checkoutUrl.searchParams.set("pubkey", pubkey)
    checkoutUrl.searchParams.set("return_url", origin + pages.space.path({url}))

    await savePendingCheckout(url, pubkey)

    location.href = checkoutUrl.toString()
  } else {
    return "This space has not said where to pay."
  }
}

// Asks the space again whether it lists the user, authenticating rather than closing a socket that may still be connecting.
export const reconcileSpace = async (url: string) => {
  await authenticate(url)

  const members = await relayMemberLists.get().forceLoad(url)

  return Boolean(members?.isMember(User.require(app.get()).pubkey))
}

export const trustSpace = (url: string) => addTrustedRelay(url)

// A user who won't trust a space they joined leaves it, so the relay stops listing them too.
export const distrustSpace = async (url: string) => {
  if (get(userSpaceUrls).includes(url)) {
    await leaveSpace(url)
  } else {
    await removeTrustedRelay(url)
  }
}

export const followMove = (oldUrl: string, newUrl: string) =>
  roomLists
    .get()
    .migrateRelay(oldUrl, newUrl)
    .then(command => command && publishRoomList(command))

export const retrySpace = async (url: string) => {
  await authenticate(url)

  refreshSpace(url)
}
