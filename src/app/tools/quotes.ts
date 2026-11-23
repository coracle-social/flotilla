import * as nip19 from "nostr-tools/nip19"
import {first, removeUndefined} from "@welshman/lib"
import {
  EventRef,
  outbox,
  relays as relaySelections,
  seen,
  sortEventsDesc,
  toNostrURI,
} from "@welshman/util"
import type {IEventRef, TrustedEvent} from "@welshman/util"
import {isAddress, isEvent} from "@welshman/content"
import type {Parsed, ParsedAddress, ParsedEvent} from "@welshman/content"
import {network, router} from "@app/core/plugins"

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
  const events = await network.get().load({filters, relays})

  return first(sortEventsDesc(events))
}

// The editor reads the entity back out of the content, which is where the q tag comes from.
export const makeQuoteContent = async (event: TrustedEvent) => {
  const relays = await router.get().resolver.relays([outbox(event.pubkey)])
  const pointer = {id: event.id, author: event.pubkey, relays}

  return toNostrURI(nip19.neventEncode(pointer)) + "\n"
}
