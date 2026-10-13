import {derived, readable} from "svelte/store"
import type {Readable} from "svelte/store"
import {getIdFilters, getIdOrAddress} from "@welshman/util"
import type {TrustedEvent} from "@welshman/util"
import {events, network, roomPinLists} from "@app/core"
import {pushToast} from "@app/toast"

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

        return events
          .get()
          .forUrl(url, filters)
          .$.subscribe($events => {
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

export const toggleRoomPin = async (url: string, h: string, event: TrustedEvent) => {
  const pins = roomPinLists.get().pins(url, h).get()
  const keys = [event.id, getIdOrAddress(event)]
  const wasPinned = pins.some(pin => keys.includes(pin))
  const command = await roomPinLists
    .get()
    .setPins(url, h, wasPinned ? pins.filter(pin => !keys.includes(pin)) : [...pins, event.id])
  const error = await command.publishToRelays([url]).getError()

  if (error) {
    pushToast({theme: "error", message: error})
  } else {
    pushToast({message: wasPinned ? "Message unpinned" : "Message pinned"})
  }
}
