import {derived, readable} from "svelte/store"
import {call, on, simpleCache} from "@welshman/lib"
import {normalizeRelayUrl} from "@welshman/util"
import {AuthStateEvent, AuthStatus, SocketEvent, SocketStatus} from "@welshman/net"
import {throttled} from "@welshman/store"
import {checkRelayHasLivekit} from "$lib/livekit"
import {app} from "@app/core"
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

export const deriveSocketStatus = (url: string) =>
  throttled(
    800,
    derived([deriveSocket(url), relaysMostlyRestricted], ([$socket, $relaysMostlyRestricted]) => {
      if ($socket.status === SocketStatus.Opening) {
        return {theme: "warning", title: "Connecting"}
      }

      if ($socket.status === SocketStatus.Closing) {
        return {theme: "gray-500", title: "Not Connected"}
      }

      if ($socket.status === SocketStatus.Closed) {
        return {theme: "gray-500", title: "Not Connected"}
      }

      if ($socket.status === SocketStatus.Error) {
        return {theme: "error", title: "Failed to Connect"}
      }

      if ($socket.auth.status === AuthStatus.Requested) {
        return {theme: "warning", title: "Authenticating"}
      }

      if ($socket.auth.status === AuthStatus.PendingSignature) {
        return {theme: "warning", title: "Authenticating"}
      }

      if ($socket.auth.status === AuthStatus.DeniedSignature) {
        return {theme: "error", title: "Failed to Authenticate"}
      }

      if ($socket.auth.status === AuthStatus.PendingResponse) {
        return {theme: "warning", title: "Authenticating"}
      }

      if ($socket.auth.status === AuthStatus.Forbidden) {
        return {theme: "error", title: "Access Denied"}
      }

      if ($relaysMostlyRestricted[url]) {
        return {theme: "error", title: "Access Denied"}
      }

      return {theme: "success", title: "Connected"}
    }),
  )

export const deriveHasLivekit = simpleCache(([url]: [string]) =>
  readable<boolean | undefined>(undefined, set => {
    checkRelayHasLivekit(url).then(has => set(has))
  }),
)
