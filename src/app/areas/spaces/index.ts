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
import {registerRetention} from "@app/core/database"
import {registerSync, syncEach} from "@app/core/sync"
import {registerActivity} from "@app/tools/activity"
import {CONTENT_KINDS} from "@app/tools/content"
import {registerReminders} from "@app/tools/reminders"
import {currentSpaceUrls, syncedSpaceUrls} from "@app/navigation/history"
import {syncCurrentSpaceContent, syncSpaceContent, syncSpaceRelays} from "@app/areas/spaces/sync"
import {spaceActivity} from "@app/areas/spaces/activity"
import {calendarReminders} from "@app/areas/spaces/reminders"

export * from "@app/areas/spaces/reactions"
export {syncCurrentSpace} from "@app/areas/spaces/sync"

export const registerSpaces = () => {
  registerActivity(spaceActivity)
  registerReminders(calendarReminders)
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
