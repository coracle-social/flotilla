import {derived} from "svelte/store"
import type {Readable} from "svelte/store"
import {getIdFilters, outbox} from "@welshman/util"
import type {TrustedEvent} from "@welshman/util"
import {network, pinLists, router} from "@app/core"
import {deriveEvents} from "@app/repository"

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
            network.get().load({relays: $relays, filters, signal: controller.signal}),
          )

        const unsubscribe = deriveEvents(filters).subscribe(set)

        return () => {
          controller.abort()
          unsubscribe()
        }
      }

      set([])
    },
    [] as TrustedEvent[],
  )
