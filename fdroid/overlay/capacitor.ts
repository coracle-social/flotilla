import type {IPushAdapter} from "@app/features/push/adapters/common"
import type {PushPermission} from "@app/features/push/permission"

// Resolves the static import after the push plugin is removed; Android selects the fallback adapter.
export class CapacitorNotifications implements IPushAdapter {
  async check(): Promise<PushPermission> {
    return "unavailable"
  }

  async request(): Promise<PushPermission> {
    return "unavailable"
  }

  async enable() {}

  async disable() {}
}
