import type {PushPermission} from "@lib/push/permission"

export type PushAdapter = {
  check: () => Promise<PushPermission>
  request: () => Promise<PushPermission>
  disable: () => Promise<void>
  enable: () => Promise<void>
}
