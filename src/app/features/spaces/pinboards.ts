import * as nip19 from "nostr-tools/nip19"
import {derived} from "svelte/store"
import type {Readable} from "svelte/store"
import {sortBy, tryCatch} from "@welshman/lib"
import type {Maybe} from "@welshman/lib"
import {Address, EventRef, PIN, PINBOARD, fromNostrURI, isReplaceable} from "@welshman/util"
import type {TrustedEvent} from "@welshman/util"
import {Pin, Pinboard} from "@welshman/domain"
import type {PinReader, PinReference, PinWriter, PinboardReader} from "@welshman/domain"
import {isLink, parse} from "@welshman/content"
import {Events, publish} from "@welshman/app"
import {isImageUrl} from "@lib/media"
import {app, fromApp} from "@app/core/app"
import {user} from "@app/core/user"
import {deletes, relayManagement, relays} from "@app/core/plugins"
import {command, reader, writer} from "@app/core/domain"
import {registerSync} from "@app/core/sync"
import {syncCurrentSpace} from "@app/features/spaces/sync"
import {addressWriterToSpace} from "@app/features/spaces/rooms/publish"

// A pin's reference as the user would type it: a nostr link for an event, and the external id otherwise.
export const pinToReference = (pin: PinReader) => {
  const reference = pin.reference()

  return reference instanceof EventRef ? (reference.toNip19() ?? "") : (reference?.external ?? "")
}

// A replaceable event is pinned by its address, so the pin follows the newest version.
export const eventToReference = (event: TrustedEvent) => {
  const ref = isReplaceable(event)
    ? EventRef.fromAddress(Address.fromEvent(event))
    : EventRef.fromEvent(event)

  return ref.toNip19() ?? ""
}

// Pins have no pubkey reference type, so a person is stored as the external id the user gave.
const isProfileEntity = (entity: string) => {
  const type = tryCatch(() => nip19.decode(fromNostrURI(entity)).type)

  return type === "npub" || type === "nprofile"
}

// Read a user-entered nostr link or external url as a pin reference.
export const parsePinReference = (input: string): Maybe<PinReference> => {
  const trimmed = input.trim()
  const parsed = parse({content: trimmed})

  if (isProfileEntity(trimmed)) {
    return {external: fromNostrURI(trimmed)}
  }

  if (parsed.length === 1 && isLink(parsed[0])) {
    return {external: trimmed}
  }

  return EventRef.fromNip19(trimmed)
}

export const deriveShelves = (url: string): Readable<PinboardReader[]> =>
  derived(
    fromApp($app => $app.use(Events).forUrl(url, [{kinds: [PINBOARD]}]).$),
    $events => $events.map(reader(Pinboard)),
  )

export const derivePins = (url: string): Readable<PinReader[]> =>
  derived(
    fromApp($app => $app.use(Events).forUrl(url, [{kinds: [PIN]}]).$),
    $events => $events.map(reader(Pin)),
  )

export const deriveShelf = (url: string, address: string): Readable<Maybe<PinboardReader>> =>
  derived(
    fromApp($app => $app.use(Events).one(address, [url]).$),
    $event => ($event ? reader(Pinboard)($event) : undefined),
  )

const matchesTerm = (term: string, fields: Maybe<string>[]) =>
  fields.some(field => field?.toLowerCase().includes(term))

export const shelfMatchesTerm = (shelf: PinboardReader, term: string) =>
  matchesTerm(term, [shelf.title(), shelf.description(), ...shelf.topics()])

export const pinMatchesTerm = (pin: PinReader, term: string) =>
  matchesTerm(term, [pin.title(), pin.content(), pinToReference(pin), ...pin.topics()])

// A pin's own words. Its reference is rendered as a link rather than named here.
export const displayPin = (pin: PinReader) => pin.title() || pin.content() || "Untitled link"

// A shelf with no cover of its own is illustrated by the pictures on it.
export const shelfCoverImages = (pins: PinReader[]) => {
  const images: string[] = []

  for (const pin of sortBy(pin => -pin.event.created_at, pins)) {
    const ref = pin.reference()
    const external = ref instanceof EventRef ? undefined : ref?.external

    if (external && isImageUrl(external, pin.event)) {
      images.push(external)

      if (images.length === 3) {
        break
      }
    }
  }

  return images
}

// A library pin is published to the space rather than to an author outbox, so every write goes there.
const publishToSpace = async (url: string, eventWriter: PinWriter) => {
  await addressWriterToSpace(eventWriter, url)

  const publication = await command(eventWriter).then(publish)

  return publication.getError()
}

// One write per pin: a second update built from the same reader would undo the first.
export const movePinsToShelf = (url: string, pins: PinReader[], from: string, to: string) =>
  Promise.all(pins.map(pin => publishToSpace(url, writer(Pin, pin).addBoard(to).removeBoard(from))))

export const removePinsFromShelf = (url: string, pins: PinReader[], address: string) =>
  Promise.all(pins.map(pin => publishToSpace(url, writer(Pin, pin).removeBoard(address))))

// Your own goes as a kind 5; anyone else's is a NIP-86 ban, which the repository never hears about.
export const deleteLibraryEvent = async (url: string, event: TrustedEvent) => {
  if (event.pubkey === user.get().pubkey) {
    const relay = await relays.get().load(url)
    const request = await deletes
      .get()
      .deleteEvent(event, deleteWriter => deleteWriter.setProtected(relay?.hasNip(70)))

    return request.publishToRelays([url]).getError()
  }

  const {error} = await relayManagement.get().forUrl(url).banEvent(event.id)

  if (!error) {
    await app.get().repository.removeEvent(event.id)
  }

  return error
}

export const deletePins = (url: string, pins: PinReader[]) =>
  Promise.all(pins.map(pin => deleteLibraryEvent(url, pin.event)))

export const registerPinboards = () => {
  registerSync(() => syncCurrentSpace([{kinds: [PINBOARD]}]))
}
