import {first, removeUndefined} from "@welshman/lib"
import {EventRef, relays as relaySelections, seen, sortEventsDesc} from "@welshman/util"
import type {IEventRef, TrustedEvent} from "@welshman/util"
import {isAddress, isEvent} from "@welshman/content"
import type {Parsed, ParsedAddress, ParsedEvent} from "@welshman/content"
import {events, network, router} from "@app/core/plugins"
import {pushModal} from "@app/navigation/dialogs"
import {goToEvent} from "@app/navigation/locations"
import QuoteLoading from "@app/components/QuoteLoading.svelte"

export const isQuote = (parsed: Parsed): parsed is ParsedEvent | ParsedAddress =>
  isEvent(parsed) || isAddress(parsed)

// Include the relays an event came from since we're in a partially relay-centric situation.
export const getQuoteRelays = (ref: IEventRef, event: TrustedEvent, url?: string) =>
  router
    .get()
    .resolver.relays([
      ...relaySelections(removeUndefined([url])),
      ...new EventRef(ref).getRelaySelections(),
      seen(event, 0.5),
    ])

export const loadQuote = async (ref: IEventRef, event: TrustedEvent, url?: string) => {
  const relays = await getQuoteRelays(ref, event, url)
  const filters = new EventRef(ref).getFilters()
  const events = await network.get().load({filters, relays, timeout: 3000})

  return first(sortEventsDesc(events))
}

// A quote names an event that may not have arrived, so a modal loads it before going anywhere.
export const goToQuote = (ref: IEventRef, event: TrustedEvent, url?: string) => {
  const idOrAddress = new EventRef(ref).getIdOrAddress()
  const loaded = idOrAddress ? events.get().one(idOrAddress).get() : undefined

  if (loaded) {
    goToEvent(loaded)
  } else {
    pushModal(QuoteLoading, {ref, event, url})
  }
}
