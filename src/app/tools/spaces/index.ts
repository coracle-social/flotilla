import {
  RELAY_ADD_MEMBER,
  RELAY_JOIN,
  RELAY_LEAVE,
  RELAY_MEMBERS,
  RELAY_REMOVE_MEMBER,
} from "@welshman/util"
import {appPolicies} from "@app/core/app"
import {registerRetention} from "@app/core/database"
import {registerSync, syncEach} from "@app/core/sync"
import {syncedSpaceUrls} from "@app/navigation/history"
import {clearSpaceModel, syncSpaceMembership} from "@app/tools/spaces/model"

export * from "@app/tools/spaces/actions"
export * from "@app/tools/spaces/fees"
export * from "@app/tools/spaces/model"
export * from "@app/tools/spaces/refusal"

export const registerSpaceModel = () => {
  registerSync(() => syncEach(syncedSpaceUrls, syncSpaceMembership))

  registerRetention({
    match: event =>
      [RELAY_ADD_MEMBER, RELAY_REMOVE_MEMBER, RELAY_MEMBERS, RELAY_JOIN, RELAY_LEAVE].includes(
        event.kind,
      ),
    provenance: true,
  })

  // What the model learned is about one user's session, so a new app starts without it.
  appPolicies.push(() => clearSpaceModel)
}
