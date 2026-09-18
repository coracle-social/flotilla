import type {IPushAdapter} from "@app/push/adapters/common"

// Resolves the static import after the push plugin is removed; Android selects the fallback adapter.
export class CapacitorNotifications implements IPushAdapter {
  async request() {
    return "denied"
  }

  async enable() {}

  async disable() {}
}
