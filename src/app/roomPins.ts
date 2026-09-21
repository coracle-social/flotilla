import {derived, readable} from "svelte/store"
import type {Readable} from "svelte/store"
import {getIdFilters, getIdOrAddress} from "@welshman/util"
import type {TrustedEvent} from "@welshman/util"
import {network, roomPinLists} from "@app/core"
import {deriveEventsForUrl} from "@app/repository"

export const deriveRoomPinnedEvents = (url: string, h: string): Readable<TrustedEvent[]> =>
  readable<TrustedEvent[]>([], set => {
    const controller = new AbortController()

    roomPinLists.get().loadForRoom(url, h, controller.signal)

    const unsubscribe = derived<Readable<string[]>, TrustedEvent[]>(
      roomPinLists.get().pins(url, h).$,
      ($pins, setEvents) => {
        if ($pins.length === 0) {
          setEvents([])

          return () => {}
        }

        const filters = getIdFilters($pins)

        network.get().loadLenient({relays: [url], filters, signal: controller.signal})

        return deriveEventsForUrl(url, filters).subscribe($events => {
          const byPin = new Map(
            $events.flatMap(event => [
              [event.id, event],
              [getIdOrAddress(event), event],
            ]),
          )

          setEvents(
            $pins.flatMap(pin => {
              const event = byPin.get(pin)

              return event ? [event] : []
            }),
          )
        })
      },
    ).subscribe(set)

    return () => {
      controller.abort()
      unsubscribe()
    }
  })
