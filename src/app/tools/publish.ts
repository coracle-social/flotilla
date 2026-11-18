import {uniq} from "@welshman/lib"
import {relay} from "@welshman/util"
import type {BaseEventReader, EventWriter} from "@welshman/domain"
import type {Command} from "@welshman/app"
import {publisher} from "@app/core/plugins"
import {INDEXER_RELAYS, SCHEDULER_RELAY} from "@app/core/env"

// The scheduler relay holds a post dated ahead of now, and forwards it to the author's relays when it's due.
export const scheduleWriter = <W extends EventWriter<BaseEventReader>>(
  eventWriter: W,
  at: number,
) => eventWriter.setCreatedAt(at).forceRoutes(relay(SCHEDULER_RELAY))

// welshman's Command.publish takes no options, so a send delay goes to the publisher directly.
export const publishWithDelay = (delay?: number) => (command: Command) =>
  publisher.get().publish({event: command.event, relays: command.relays, delay})

export class ScheduleError extends Error {}

// Room lists also go to the indexers, which is where the space browser looks for them.
export const publishRoomList = (command: Command) =>
  command.publishToRelays(uniq([...command.relays, ...INDEXER_RELAYS]))
