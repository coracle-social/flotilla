import {STATUS} from "@welshman/util"
import type {TrustedEvent} from "@welshman/util"
import {DerivedPlugin, Network} from "@welshman/app"
import type {IApp} from "@welshman/app"
import {usePlugin} from "@app/core"

// NIP-38 keys a status by its `d` tag. "general" is the one clients read as what someone is up to;
// "music" is the other one in the spec and belongs to a player rather than a profile.
const filter = {kinds: [STATUS], "#d": ["general"]}

export class Statuses extends DerivedPlugin<TrustedEvent> {
  constructor(app: IApp) {
    super(app, {
      filters: [filter],
      eventToItem: event => event,
      getKey: event => event.pubkey,
    })
  }

  fetch(pubkey: string, hints: string[] = []) {
    return this.app.use(Network).loadUsingOutbox(pubkey, filter, hints)
  }
}

export const statuses = usePlugin(Statuses)
