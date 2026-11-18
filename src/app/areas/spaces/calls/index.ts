import {registerSync} from "@app/core/sync"
import {syncCurrentSpace} from "@app/areas/spaces/sync"
import {LIVEKIT_PARTICIPANTS} from "@app/areas/spaces/calls/participants"

export * from "@app/areas/spaces/calls/endpoint"
export * from "@app/areas/spaces/calls/state"
export * from "@app/areas/spaces/calls/participants"
export * from "@app/areas/spaces/calls/layout"

export const registerCalls = () => {
  registerSync(() => syncCurrentSpace([{kinds: [LIVEKIT_PARTICIPANTS]}]))
}
