import * as nip19 from "nostr-tools/nip19"
import {derived} from "svelte/store"
import type {Readable} from "svelte/store"
import {removeUndefined, sortBy} from "@welshman/lib"
import type {Maybe} from "@welshman/lib"
import {Address, PIN, PINBOARD, fromNostrURI, getAddress, isReplaceable} from "@welshman/util"
import type {TrustedEvent} from "@welshman/util"
import {Pin, Pinboard} from "@welshman/domain"
import type {PinReader, PinReference, PinWriter, PinboardReader} from "@welshman/domain"
import {isLink, parse} from "@welshman/content"
import {publish} from "@welshman/app"
import {
  app,
  command,
  deletes,
  events,
  reader,
  relayManagement,
  relays,
  user,
  writer,
} from "@app/core"
import {addressWriterToSpace} from "@app/rooms"
import {isImageUrl} from "@app/content"
import {compressFileForUpload, uploadFile} from "@app/uploads"

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

export const deriveShelves = (url: string): Readable<PinboardReader[]> =>
  derived(events.get().forUrl(url, [{kinds: [PINBOARD]}]).$, $events =>
    $events.map(reader(Pinboard)),
  )

export const derivePins = (url: string): Readable<PinReader[]> =>
  derived(events.get().forUrl(url, [{kinds: [PIN]}]).$, $events => $events.map(reader(Pin)))

export const deriveShelf = (url: string, address: string): Readable<Maybe<PinboardReader>> =>
  derived(events.get().one(address, [url]).$, $event =>
    $event ? reader(Pinboard)($event) : undefined,
  )

const matchesTerm = (term: string, fields: Maybe<string>[]) =>
  fields.some(field => field?.toLowerCase().includes(term))

export const shelfMatchesTerm = (shelf: PinboardReader, term: string) =>
  matchesTerm(term, [shelf.title(), shelf.description(), ...shelf.topics()])

export const pinMatchesTerm = (pin: PinReader, term: string) =>
  matchesTerm(term, [pin.title(), pin.content(), pinToReference(pin), ...pin.topics()])

// A pin's own words. Its reference is rendered as a link rather than named here.
export const displayPin = (pin: PinReader) => pin.title() || pin.content() || "Untitled link"

const pinImage = (pin: PinReader) => {
  const reference = pin.reference()

  if (reference?.type === "external" && isImageUrl(reference.id, pin.event)) {
    return reference.id
  }

  return undefined
}

// A shelf with no cover of its own is illustrated by the pictures on it.
export const shelfCoverImages = (pins: PinReader[]) =>
  removeUndefined(sortBy(pin => -pin.event.created_at, pins).map(pinImage)).slice(0, 3)

// A library pin is published to the space rather than to an author outbox, so every write goes there.
const publishToSpace = async (url: string, eventWriter: PinWriter) => {
  await addressWriterToSpace(eventWriter, url)

  const publication = await command(eventWriter).then(publish)

  return (await publication.settled()).getError()
}

// One write per pin: a second update built from the same reader would undo the first.
export const movePinsToShelf = (url: string, pins: PinReader[], from: string, to: string) =>
  Promise.all(pins.map(pin => publishToSpace(url, writer(Pin, pin).addBoard(to).removeBoard(from))))

export const removePinsFromShelf = (url: string, pins: PinReader[], address: string) =>
  Promise.all(pins.map(pin => publishToSpace(url, writer(Pin, pin).removeBoard(address))))

// Your own goes as a kind 5; anyone else's is a NIP-86 ban, which the repository never hears about.
export const deleteLibraryEvent = async (url: string, event: TrustedEvent) => {
  if (event.pubkey === user.get().pubkey) {
    const protect = await relays.get().hasNip(url, 70)
    const request = await deletes
      .get()
      .deleteEvent(event, deleteWriter => deleteWriter.setProtected(protect))

    return (await request.publishToRelays([url]).settled()).getError()
  }

  const {error} = await relayManagement.get().forUrl(url).banEvent(event.id)

  if (!error) {
    app.get().repository.removeEvent(event.id)
  }

  return error
}

export const deletePins = (url: string, pins: PinReader[]) =>
  Promise.all(pins.map(pin => deleteLibraryEvent(url, pin.event)))

export const uploadFilesAsReferences = async (url: string, files: File[]) => {
  const references: string[] = []
  const errors: string[] = []

  for (const file of files) {
    const {result, error} = await uploadFile(await compressFileForUpload(file), {url})

    if (result) {
      references.push(result.url)
    } else {
      errors.push(error ?? `${file.name} could not be uploaded.`)
    }
  }

  return {references, errors}
}
