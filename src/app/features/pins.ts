import {derived} from "svelte/store"
import type {Readable} from "svelte/store"
import {getIdFilters, outbox} from "@welshman/util"
import {PinLists} from "@welshman/app"
import type {TrustedEvent} from "@welshman/util"
import {fromApp} from "@app/core/app"
import {events, network, router} from "@app/core/plugins"

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
            network.get().loadLenient({relays: $relays, filters, signal: controller.signal}),
          )

        const unsubscribe = events.get().desc(filters).$.subscribe(set)

        return () => {
          controller.abort()
          unsubscribe()
        }
      }

      set([])
    },
    [] as TrustedEvent[],
  )
