import {int, spec, MONTH} from "@welshman/lib"
import {
  COMMENT,
  DELETE,
  MESSAGE,
  POLL_RESPONSE,
  REPORT,
  ROOMS,
  tagSpec,
  tagValue,
} from "@welshman/util"
import {syncUserList} from "@app/core/user"
import {roomLists} from "@app/core/plugins"
import {registerRetention} from "@app/core/storage"
import {registerSync, syncEach} from "@app/core/sync"
import {CONTENT_KINDS} from "@app/features/spaces/content"
import {currentSpaceUrls, syncedSpaceUrls} from "@app/features/spaces/urls"
import {syncCurrentSpaceContent, syncSpaceContent, syncSpaceRelays} from "@app/features/spaces/sync"

export * from "@app/features/spaces/content"
export * from "@app/features/spaces/urls"
export * from "@app/features/spaces/reactions"
export {syncCurrentSpace} from "@app/features/spaces/sync"

export const registerSpaces = () => {
  registerSync(syncSpaceRelays)
  registerSync(() => syncUserList(pubkey => roomLists.get().load(pubkey)))
  registerSync(() => syncEach(syncedSpaceUrls, syncSpaceContent))
  registerSync(() => syncEach(currentSpaceUrls, syncCurrentSpaceContent))

  registerRetention({match: spec({kind: ROOMS}), ttl: int(1, MONTH)})

  // A space is asked for its own content on every load, so a month of it bounds the read at startup.
  registerRetention({
    match: event =>
      [MESSAGE, COMMENT, DELETE, REPORT, POLL_RESPONSE, ...CONTENT_KINDS].includes(event.kind) &&
      Boolean(tagValue(tagSpec("h"), event.tags)),
    maxAge: int(1, MONTH),
    provenance: true,
  })
}
