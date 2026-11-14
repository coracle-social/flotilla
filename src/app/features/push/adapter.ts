import type {PushPermission} from "@app/features/push/permission"

export type PushAdapter = {
  check: () => Promise<PushPermission>
  request: () => Promise<PushPermission>
  disable: () => Promise<void>
  enable: () => Promise<void>
}
