import {derived} from "svelte/store"
import type {Readable} from "svelte/store"
import {getIdFilters, outbox} from "@welshman/util"
import type {TrustedEvent} from "@welshman/util"
import {events, network, pinLists, router} from "@app/core"

export const derivePinnedEvents = (pubkey: string): Readable<TrustedEvent[]> =>
  derived(
    pinLists.get().one(pubkey),
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
