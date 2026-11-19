import type {BaseEventReader, EventQuery, EventWriter, KindFactory} from "@welshman/domain"
import {domain} from "@app/core/plugins"
import {requireUser} from "@app/core/user"

// The domain entry points, since almost every read or write goes through one of them.
export const reader = <R extends BaseEventReader, W extends EventWriter<R>, Q extends EventQuery>(
  factory: KindFactory<R, W, Q>,
) => domain.get().reader(factory)

export const writer = <R extends BaseEventReader, W extends EventWriter<R>, Q extends EventQuery>(
  factory: KindFactory<R, W, Q>,
  seed?: R,
) => domain.get().writer(factory, seed)

export const command = (eventWriter: EventWriter<any>) => {
  requireUser()

  return domain.get().command(eventWriter)
}
