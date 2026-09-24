import * as nip19 from "nostr-tools/nip19"
import {Address, fromNostrURI, getAddress, isReplaceable} from "@welshman/util"
import type {TrustedEvent} from "@welshman/util"
import type {PinReader, PinReference, PinWriter} from "@welshman/domain"
import {isLink, parse} from "@welshman/content"

const encodeReference = (reference: PinReference) => {
  if (reference.type === "event") {
    return nip19.neventEncode({id: reference.id, relays: reference.relay ? [reference.relay] : []})
  }

  if (reference.type === "address") {
    const {kind, pubkey, identifier} = Address.from(reference.address)

    return nip19.naddrEncode({
      kind,
      pubkey,
      identifier,
      relays: reference.relay ? [reference.relay] : [],
    })
  }

  return reference.id
}

export const pinToReference = (pin: PinReader) => {
  const reference = pin.reference()

  return reference ? encodeReference(reference) : ""
}

export const eventToReference = (event: TrustedEvent) =>
  encodeReference(
    isReplaceable(event)
      ? {type: "address", address: getAddress(event)}
      : {type: "event", id: event.id},
  )

// Point a pin at a user-entered nostr link or external url, false if it's neither.
export const setPinReference = (writer: PinWriter, reference: string) => {
  const trimmed = reference.trim()

  try {
    const decoded = nip19.decode(fromNostrURI(trimmed))

    if (decoded.type === "note") {
      writer.setEvent(decoded.data)
      return true
    }

    if (decoded.type === "nevent") {
      writer.setEvent(decoded.data.id, decoded.data.relays?.[0])
      return true
    }

    // Pins have no pubkey reference type, so a person is stored as the external id the user gave.
    if (decoded.type === "npub" || decoded.type === "nprofile") {
      writer.setExternal(fromNostrURI(trimmed))
      return true
    }

    if (decoded.type === "naddr") {
      const {kind, pubkey, identifier, relays} = decoded.data

      writer.setAddress(new Address(kind, pubkey, identifier).toString(), relays?.[0])
      return true
    }

    return false
  } catch {
    // Not a nostr entity; fall through to external url handling.
  }

  const parsed = parse({content: trimmed})

  if (parsed.length === 1 && isLink(parsed[0])) {
    writer.setExternal(trimmed)
    return true
  }

  return false
}
