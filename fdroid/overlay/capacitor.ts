import type {PushAdapter} from "@app/tools/push/adapter"

// Resolves the static import after the push plugin is removed; Android selects the fallback adapter.
export const createCapacitorNotifications = (): PushAdapter => ({
  check: async () => "unavailable",
  request: async () => "unavailable",
  enable: async () => {},
  disable: async () => {},
})
