import {derived} from "svelte/store"
import type {Readable} from "svelte/store"
import {getIdFilters, outbox, sortEventsDesc} from "@welshman/util"
import {observeEventsById} from "@welshman/store"
import {PinLists} from "@welshman/app"
import type {TrustedEvent} from "@welshman/util"
import {app, fromApp} from "@app/core/app"
import {network, router} from "@app/core/plugins"

export const derivePinnedEvents = (pubkey: string): Readable<TrustedEvent[]> =>
  derived(
    fromApp($app => $app.use(PinLists).one(pubkey)),
    ($pinList, set: (events: TrustedEvent[]) => void) => {
      const ids = $pinList?.ids() || []

      if (ids.length > 0) {
        const controller = new AbortController()
        const filters = getIdFilters(ids)

        router
          .get()
          .resolver.relays([outbox(pubkey)])
          .then($relays =>
            network.get().load({
              relays: $relays,
              filters,
              signal: controller.signal,
            }),
          )

        const unsubscribe = observeEventsById({
          filters,
          repository: app.get().repository,
          onEvents: $byId => set(sortEventsDesc($byId.values())),
        })

        return () => {
          controller.abort()
          unsubscribe()
        }
      }

      set([])
    },
    [] as TrustedEvent[],
  )
