import {RelayReasonPrefix, matchReason} from "@welshman/net"
import {stripPrefix} from "@lib/util"

// How a space answered a request to join it, read once from the relay's words.
export type JoinRefusal =
  | {kind: "claim"}
  | {kind: "rejected"}
  | {kind: "payment"}
  | {kind: "denied"; message: string}
  | {kind: "muted"}
  | {kind: "auth"; message: string}
  | {kind: "no-membership"}
  | {kind: "unreachable"; message: string}
  | {kind: "cancelled"}
  | {kind: "other"; message: string}

// Beyond NIP-01's prefixes, these are the phrases zooid and caravel use.
export const parseRefusal = (error: string): JoinRefusal => {
  const message = stripPrefix(error)

  if (error.includes("Signing was aborted")) {
    return {kind: "cancelled"}
  }

  if (matchReason(RelayReasonPrefix.Mute, error)) {
    return {kind: "muted"}
  }

  if (matchReason(RelayReasonPrefix.AuthRequired, error)) {
    return {kind: "auth", message}
  }

  if (error.includes("missing group (`h`) tag")) {
    return {kind: "no-membership"}
  }

  if (error.includes("invite code")) {
    return {kind: "rejected"}
  }

  if (error.includes("claim")) {
    return {kind: "claim"}
  }

  if (error.includes("paid membership")) {
    return {kind: "payment"}
  }

  if (matchReason(RelayReasonPrefix.Blocked, error)) {
    return {kind: "denied", message}
  }

  if (/failed to connect|timed out|timeout|network/i.test(error)) {
    return {kind: "unreachable", message}
  }

  return {kind: "other", message}
}

export const displayRefusal = (refusal: JoinRefusal) => {
  switch (refusal.kind) {
    case "claim":
      return "This space requires an invite code"
    case "rejected":
      return "join request rejected"
    case "payment":
      return "This space requires a paid membership"
    case "muted":
      return "The space ignored the request to join"
    case "no-membership":
      return "This relay doesn't hold space memberships"
    case "cancelled":
      return "Signing was cancelled"
    default:
      return refusal.message
  }
}
