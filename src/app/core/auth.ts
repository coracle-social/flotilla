import {get} from "svelte/store"
import {on, call, noop} from "@welshman/lib"
import type {Socket} from "@welshman/net"
import {AuthStateEvent, AuthStatus} from "@welshman/net"
import {
  BlockedRelayLists,
  MessagingRelayLists,
  RelayLists,
  Publisher,
  RoomLists,
} from "@welshman/app"
import type {AppPolicy, IApp} from "@welshman/app"
import {merged} from "@welshman/store"
import {appPolicies} from "@app/core/app"
import {userSettingsValues, getSetting, RelayAuthMode} from "@app/core/settings"

// Welshman's appPolicyAuthUnlessBlocked, plus the conservative mode's relationship check.
const shouldAuth = (socket: Socket, $app: IApp) => {
  const $pubkey = $app.user?.pubkey

  if (!$pubkey) {
    return false
  }
  if ($app.use(BlockedRelayLists).urls($pubkey).get().includes(socket.url)) {
    return false
  }
  if (getSetting("relay_auth") === RelayAuthMode.Aggressive) {
    return true
  }
  if ($app.use(RoomLists).urls($pubkey).get().includes(socket.url)) {
    return true
  }
  if ($app.use(RelayLists).urls($pubkey).get().includes(socket.url)) {
    return true
  }
  if (get($app.use(Publisher).history).some(p => p.relays.includes(socket.url))) {
    return true
  }
  if ($app.use(MessagingRelayLists).urls($pubkey).get().includes(socket.url)) {
    return true
  }

  return false
}

// Everything `shouldAuth` reads, so a socket can ask it again when the answer changes.
const makeAuthInputs = ($app: IApp, pubkey: string) =>
  merged([
    $app.use(BlockedRelayLists).urls(pubkey).$,
    $app.use(MessagingRelayLists).urls(pubkey).$,
    $app.use(RelayLists).urls(pubkey).$,
    $app.use(RoomLists).urls(pubkey).$,
    $app.use(Publisher).history,
    userSettingsValues,
  ])

// A first login answers "no relationship" before the user's lists load, so ask again when one changes.
const authPolicy: AppPolicy = $app => {
  const $user = $app.user

  if ($user) {
    const authInputs = makeAuthInputs($app, $user.pubkey)

    return $app.pool.addSocketPolicy((socket: Socket) => {
      const attemptAuth = () => {
        if (socket.auth.status === AuthStatus.Requested && shouldAuth(socket, $app)) {
          socket.auth.doAuth($user.sign)
        }
      }

      const unsubscribers = [
        on(socket.auth, AuthStateEvent.Status, attemptAuth),
        authInputs.subscribe(attemptAuth),
      ]

      return () => unsubscribers.forEach(call)
    })
  }

  return noop
}

export const registerAuth = () => {
  appPolicies.push(authPolicy)
}
