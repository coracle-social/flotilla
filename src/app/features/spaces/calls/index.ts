import {registerSync} from "@app/core/sync"
import {syncCurrentSpace} from "@app/features/spaces/sync"
import {LIVEKIT_PARTICIPANTS} from "@app/features/spaces/calls/participants"

export * from "@app/features/spaces/calls/endpoint"
export * from "@app/features/spaces/calls/state"
export * from "@app/features/spaces/calls/participants"
export * from "@app/features/spaces/calls/layout"

export const registerCalls = () => {
  registerSync(() => syncCurrentSpace([{kinds: [LIVEKIT_PARTICIPANTS]}]))
}
