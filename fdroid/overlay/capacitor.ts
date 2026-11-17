import type {PushPermission} from "@lib/push/permission"
import type {PushAdapter} from "@app/features/push/adapter"

// Resolves the static import after the push plugin is removed; Android selects the fallback adapter.
export class CapacitorNotifications implements PushAdapter {
  async check(): Promise<PushPermission> {
    return "unavailable"
  }

  async request(): Promise<PushPermission> {
    return "unavailable"
  }

  async enable() {}

  async disable() {}
}
