import {get} from "svelte/store"
import {ms} from "@welshman/lib"
import type {Socket} from "@welshman/net"
import {AuthStatus} from "@welshman/net"
import {
  MessagingRelayLists,
  Publisher,
  RelayLists,
  RoomLists,
  User,
  makeAppPolicyAuth,
} from "@welshman/app"
import type {IApp} from "@welshman/app"
import {merged} from "@welshman/store"
import {app, appPolicies} from "@app/core/app"
import {RelayAuthMode, Settings} from "@app/core/settings"

// Aggressive mode answers every challenge, and otherwise only relays the user has a relationship with.
const shouldAuth = (socket: Socket, $app: IApp) => {
  const {pubkey} = User.require($app)

  return (
    $app.use(Settings).values.get().relay_auth === RelayAuthMode.Aggressive ||
    $app.use(RoomLists).urls(pubkey).get().includes(socket.url) ||
    $app.use(RelayLists).urls(pubkey).get().includes(socket.url) ||
    $app.use(MessagingRelayLists).urls(pubkey).get().includes(socket.url) ||
    get($app.use(Publisher).history).some(p => p.relays.includes(socket.url))
  )
}

// A first login declines challenges before the user's lists load, so they're answered once they do.
const authInputs = ($app: IApp) => {
  const {pubkey} = User.require($app)

  return merged([
    $app.use(MessagingRelayLists).urls(pubkey).$,
    $app.use(RelayLists).urls(pubkey).$,
    $app.use(RoomLists).urls(pubkey).$,
    $app.use(Publisher).history,
    $app.use(Settings).values.$,
  ])
}

// Authenticates to a relay now rather than when a request first needs it, returning why it failed.
export const authenticate = async (url: string) => {
  const {sign} = User.require(app.get())
  const socket = app.get().pool.get(url)
  const result = await socket.auth.authenticate(sign, AbortSignal.timeout(ms(30)))

  if (result.ok) {
    return undefined
  }

  switch (result.status) {
    case AuthStatus.None:
      return "Failed to connect"
    case AuthStatus.DeniedSignature:
      return "Failed to authenticate — check your signer"
    case AuthStatus.PendingSignature:
      return "Failed to authenticate — approve the signing request from your extension or signer"
    default:
      return `Failed to authenticate (${result.reason || result.status})`
  }
}

export const registerAuth = () => {
  appPolicies.push(makeAppPolicyAuth(shouldAuth, authInputs))
}
