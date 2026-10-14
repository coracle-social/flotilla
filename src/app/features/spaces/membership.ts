import {derived, readable} from "svelte/store"
import {RelayReasonPrefix, matchReason} from "@welshman/net"
import {
  relay,
  FOLLOWS,
  MESSAGING_RELAYS,
  PROFILE,
  RELAY_ADD_MEMBER,
  RELAY_JOIN,
  RELAY_LEAVE,
  RELAY_MEMBERS,
  RELAY_REMOVE_MEMBER,
  RELAYS,
} from "@welshman/util"
import {RelayJoin, RelayLeave} from "@welshman/domain"
import {RelayMemberLists, Sync, User, publish} from "@welshman/app"
import {stripPrefix} from "@lib/util"
import {app, fromApp} from "@app/core/app"
import {authenticate} from "@app/core/auth"
import {roomLists} from "@app/core/plugins"
import {command, writer} from "@app/core/domain"
import {removeTrustedRelay} from "@app/core/settings"
import {registerRetention} from "@app/core/storage"
import {pullAndListen, registerSync, syncApplicationData, syncEach} from "@app/core/sync"
import {optInSpaceNotifications} from "@app/features/push"
import {syncedSpaceUrls} from "@app/features/spaces/urls"
import {publishRoomList} from "@app/features/spaces/rooms/lists"

// A relay can refuse a join for reasons that still leave the user able to use the space.
export const requestMembership = async (url: string, claim = "") => {
  const eventWriter = writer(RelayJoin).forceRoutes(relay(url))

  if (claim) {
    eventWriter.setClaim(claim)
  }

  const publication = await command(eventWriter).then(publish)
  const error = await publication.getError()

  if (error) {
    const isIgnored = matchReason(RelayReasonPrefix.Mute, error)
    const isAborted = error.includes("Signing was aborted")
    const isStrictNip29Relay = error.includes("missing group (`h`) tag")

    if (isIgnored || isAborted || isStrictNip29Relay) {
      return undefined
    }

    if (error.includes("invite code")) {
      return "join request rejected"
    }

    // A space that isn't open to the public refuses a join carrying no claim at all
    if (error.includes("claim")) {
      return "This space requires an invite code"
    }

    return stripPrefix(error)
  }
}

export const attemptRelayAccess = async (url: string, claim = "") => {
  const authError = await authenticate(url)

  return authError || requestMembership(url, claim)
}

export const completeSpaceJoin = async (url: string, notifications: boolean) => {
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
          kinds: [RELAYS, MESSAGING_RELAYS, FOLLOWS, PROFILE],
          authors: [User.require(app.get()).pubkey],
        },
      ],
    })
}

export const leaveSpace = async (url: string) => {
  await roomLists.get().removeRelay(url).then(publishRoomList)
  await command(writer(RelayLeave).forceRoutes(relay(url))).then(publish)
  await removeTrustedRelay(url)
}

export const derivePubkeyIsSpaceMember = (url: string, pubkey: string) =>
  derived(
    fromApp($app => $app.use(RelayMemberLists).forUrl(url)),
    $members => Boolean($members?.isMember(pubkey)),
  )

export const deriveUserIsSpaceMember = (url: string) =>
  fromApp($app => ($app.user ? derivePubkeyIsSpaceMember(url, $app.user.pubkey) : readable(false)))

const syncSpaceMembership = (url: string) => {
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

export const registerMembership = () => {
  registerSync(() => syncEach(syncedSpaceUrls, syncSpaceMembership))

  registerRetention({
    match: event =>
      [RELAY_ADD_MEMBER, RELAY_REMOVE_MEMBER, RELAY_MEMBERS, RELAY_JOIN, RELAY_LEAVE].includes(
        event.kind,
      ),
    provenance: true,
  })
}
