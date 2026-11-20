import {get} from "svelte/store"
import {ms, noop, on} from "@welshman/lib"
import type {Maybe} from "@welshman/lib"
import type {Socket} from "@welshman/net"
import {AuthStateEvent, AuthStatus, makeSocketPolicyAuth} from "@welshman/net"
import {Nip01Signer} from "@welshman/signer"
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
import {PLATFORM_RELAYS} from "@app/core/env"
import {RelayAuthMode, Settings} from "@app/core/settings"

// Aggressive mode answers every challenge, and otherwise only platform relays, which may hold the user's only lists, and relays the user has a relationship with.
const shouldAuth = (socket: Socket, $app: IApp) => {
  const {pubkey} = User.require($app)

  return (
    $app.use(Settings).values.get().relay_auth === RelayAuthMode.Aggressive ||
    PLATFORM_RELAYS.includes(socket.url) ||
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

// A visitor identifies to relays with a key made for this visit, so a relay that only asks a client to identify serves them.
const guest = Nip01Signer.ephemeral()

const guestAuthPolicy = ($app: IApp) =>
  $app.user ? noop : $app.pool.addSocketPolicy(makeSocketPolicyAuth({sign: guest.sign}))

// Authenticates to a relay now rather than when a request first needs it, returning why it failed.
export const authenticate = async (url: string) => {
  const {sign} = app.get().user ?? guest
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

// A relay judges the auth event's own created_at, so one signed before the browser suspended the tab is refused for its age rather than for who signed it.
export const isStaleAuth = ({auth}: Socket) =>
  auth.status === AuthStatus.Forbidden && Boolean(auth.details?.includes("too much in the past"))

// Answers such a challenge once more, with a signature stamped now.
const staleAuthPolicy = (socket: Socket) => {
  let answered: Maybe<string>

  return on(socket.auth, AuthStateEvent.Status, () => {
    if (isStaleAuth(socket) && socket.auth.challenge !== answered) {
      answered = socket.auth.challenge

      authenticate(socket.url)
    }
  })
}

export const registerAuth = () => {
  appPolicies.push(makeAppPolicyAuth(shouldAuth, authInputs), guestAuthPolicy, $app =>
    $app.pool.addSocketPolicy(staleAuthPolicy),
  )
}
