import {first, removeUndefined} from "@welshman/lib"
import {
  Address,
  eventOutbox,
  getIdFilters,
  relays as relaySelections,
  seen,
  sortEventsDesc,
} from "@welshman/util"
import type {TrustedEvent} from "@welshman/util"
import {isAddress, isEvent} from "@welshman/content"
import type {Parsed, ParsedAddress, ParsedEvent} from "@welshman/content"
import type {AddressPointer, EventPointer} from "nostr-tools/nip19"
import {events, network, router} from "@app/core/plugins"
import {pushModal} from "@app/ui/modal"
import {goToEvent} from "@app/ui/routes"
import {getQuoteRef} from "@app/features/social"
import QuoteLoading from "@app/components/QuoteLoading.svelte"

export type QuotePointer =
  | (EventPointer & {identifier?: undefined})
  | (AddressPointer & {id?: undefined})

export const isQuote = (parsed: Parsed): parsed is ParsedEvent | ParsedAddress =>
  isEvent(parsed) || isAddress(parsed)

export const getQuoteIdOrAddress = (pointer: QuotePointer) =>
  pointer.id !== undefined
    ? pointer.id
    : new Address(pointer.kind, pointer.pubkey, pointer.identifier).toString()

// Whoever quoted an event saw it, so the relays of the event doing the quoting are asked as well.
export const getQuoteRelays = (pointer: QuotePointer, event: TrustedEvent, url?: string) => {
  const ref = getQuoteRef(pointer)

  return router
    .get()
    .resolver.relays([
      ...relaySelections(removeUndefined([url])),
      seen(ref),
      eventOutbox(ref),
      seen(event, 0.5),
    ])
}

export const loadQuote = async (pointer: QuotePointer, event: TrustedEvent, url?: string) => {
  const relays = await getQuoteRelays(pointer, event, url)
  const filters = getIdFilters([getQuoteIdOrAddress(pointer)])

  // An id names one event, so the relays that answer first have it; an address names the newest.
  const load = pointer.id ? network.get().loadLenient : network.get().loadComplete

  return first(sortEventsDesc(await load({filters, relays})))
}

// A quote names an event that may not have arrived, so a modal loads it before going anywhere.
export const goToQuote = (pointer: QuotePointer, event: TrustedEvent, url?: string) => {
  const loaded = events.get().one(getQuoteIdOrAddress(pointer)).get()

  if (loaded) {
    goToEvent(loaded)
  } else {
    pushModal(QuoteLoading, {pointer, event, url})
  }
}
