export type PushPermission = "granted" | "denied" | "prompt" | "unavailable"

export const isGranted = (permission: PushPermission) => permission === "granted"

// Nothing is left to ask: the platform has refused, or it can't notify us at all.
export const isBlocked = (permission: PushPermission) =>
  permission === "denied" || permission === "unavailable"

// Platforms spell the pending states differently, and anything else means we can't notify at all.
export const toPermission = (permission: string): PushPermission => {
  if (permission === "granted" || permission === "denied") {
    return permission
  }

  if (["default", "prompt", "prompt-with-rationale"].includes(permission)) {
    return "prompt"
  }

  return "unavailable"
}

export const getPermissionMessage = (permission: PushPermission) => {
  if (permission === "denied") {
    return "Notifications are blocked. Allow them for this app in your browser or device settings, then try again."
  }

  if (permission === "prompt") {
    return "Notifications weren't allowed. Choose Allow when your browser or device asks."
  }

  return "Notifications aren't available on this device."
}
