import {derived, readable} from "svelte/store"
import {call, on, simpleCache} from "@welshman/lib"
import {normalizeRelayUrl} from "@welshman/util"
import {AuthStateEvent, AuthStatus, SocketEvent, SocketStatus} from "@welshman/net"
import {throttled} from "@welshman/store"
import {app, relays} from "@app/core"
import {relaysMostlyRestricted} from "@app/policies"
import {colorFor} from "@app/theme"

export const encodeRelay = (url: string) =>
  encodeURIComponent(
    normalizeRelayUrl(url)
      .replace(/^wss:\/\//, "")
      .replace(/\/$/, ""),
  )

export const decodeRelay = (url: string) => normalizeRelayUrl(decodeURIComponent(url))

const relayIconHost = (url: string) =>
  normalizeRelayUrl(url)
    .replace(/^wss?:\/\//, "")
    .replace(/[:/].*$/, "")

// Darkened so white initials clear 4.5:1 on every color in the palette.
export const relayIconColor = (url: string) =>
  `color-mix(in oklab, ${colorFor(relayIconHost(url))} 80%, black)`

export const relayIconInitials = (url: string) => {
  const parts = relayIconHost(url).split(".")
  const hasSubdomain = parts.length > 2
  const [first = "", second = ""] = parts

  return (hasSubdomain ? first.slice(0, 1) + second.slice(0, 1) : first.slice(0, 2)).toUpperCase()
}

export const deriveSocket = (url: string) => {
  const socket = app.get().pool.get(url)

  return readable(socket, set => {
    const subs = [
      on(socket, SocketEvent.Error, () => set(socket)),
      on(socket, SocketEvent.Status, () => set(socket)),
      on(socket.auth, AuthStateEvent.Status, () => set(socket)),
    ]

    return () => subs.forEach(call)
  })
}

export enum RelayConnection {
  Connecting = "connecting",
  Disconnected = "disconnected",
  ConnectFailed = "connect-failed",
  Authenticating = "authenticating",
  AuthFailed = "auth-failed",
  AccessDenied = "access-denied",
  Connected = "connected",
}

export const deriveSocketStatus = (url: string) =>
  throttled(
    800,
    derived([deriveSocket(url), relaysMostlyRestricted], ([$socket, $relaysMostlyRestricted]) => {
      if ($socket.status === SocketStatus.Opening) {
        return RelayConnection.Connecting
      }

      if ($socket.status === SocketStatus.Closing || $socket.status === SocketStatus.Closed) {
        return RelayConnection.Disconnected
      }

      if ($socket.status === SocketStatus.Error) {
        return RelayConnection.ConnectFailed
      }

      if (
        $socket.auth.status === AuthStatus.Requested ||
        $socket.auth.status === AuthStatus.PendingSignature ||
        $socket.auth.status === AuthStatus.PendingResponse
      ) {
        return RelayConnection.Authenticating
      }

      if ($socket.auth.status === AuthStatus.DeniedSignature) {
        return RelayConnection.AuthFailed
      }

      if ($socket.auth.status === AuthStatus.Forbidden || $relaysMostlyRestricted[url]) {
        return RelayConnection.AccessDenied
      }

      return RelayConnection.Connected
    }),
  )

// A space that isn't a NIP-29 relay has no rooms, only one space-wide chat.
export const isGroupSpace = (url: string) => Boolean(relays.get().get(url)?.hasNip(29))

export const deriveIsGroupSpace = (url: string) =>
  derived(relays.get().one(url), $relay => Boolean($relay?.hasNip(29)))

const livekitUrl = (url: string) =>
  url.replace(/^ws/, "http").replace(/\/$/, "") + "/.well-known/nip29/livekit"

export const getLivekitEndpoint = (url: string, roomId: string) => `${livekitUrl(url)}/${roomId}`

export const deriveHasLivekit = simpleCache(([url]: [string]) =>
  readable<boolean | undefined>(undefined, set => {
    fetch(livekitUrl(url)).then(
      response => set(response.status === 204),
      () => set(false),
    )
  }),
)
