import * as nip19 from "nostr-tools/nip19"
import type {EventPointer} from "nostr-tools/nip19"
import type {TrustedEvent} from "@welshman/util"
import {pushState, replaceState} from "$app/navigation"
import {page} from "$app/state"
import {app} from "@app/core/app"
import {popHistory, traverse} from "@app/navigation/dialogs"
import {getHomePath} from "@app/navigation/history"
import {navigate} from "@app/navigation/navigate"
import {decodeNotePointer} from "@app/navigation/pages"

// A note opens over the page with its pointer in the url, so it survives a reload and can be shared.
const withNote = (url: URL, pointer?: EventPointer) => {
  const next = new URL(url)

  if (pointer) {
    next.searchParams.set("note", nip19.neventEncode(pointer))
  } else {
    next.searchParams.delete("note")
  }

  return next
}

export const getNoteOverlay = () => {
  const nevent = page.url.searchParams.get("note")
  const pointer = nevent ? decodeNotePointer(nevent) : undefined

  return pointer ? {pointer, reply: Boolean(page.state.reply)} : undefined
}

export type OpenNoteOptions = {
  reply?: boolean
  replaceState?: boolean
}

// The note covers any dialog that was open, which comes back once the note is closed.
export const openNote = (pointer: EventPointer, options: OpenNoteOptions = {}) =>
  traverse(() => {
    const url = withNote(page.url, pointer)
    const state = {...page.state, modals: [], reply: options.reply}

    if (options.replaceState) {
      replaceState(url, {...state, note: false})
    } else {
      pushState(url, {...state, note: true})
    }
  })

// An event already on screen opens as a note, pointed at the relays it was seen on.
export const openEventNote = (event: TrustedEvent, options: OpenNoteOptions = {}) =>
  openNote(
    {id: event.id, author: event.pubkey, relays: Array.from(app.get().tracker.getRelays(event.id))},
    options,
  )

// A note opened by a link or a reload has no entry of its own to go back over.
export const closeNote = () =>
  traverse(async () => {
    if (page.state.note) {
      await popHistory()
    } else {
      replaceState(withNote(page.url), {...page.state, reply: false})
    }
  })

// A url resolving to a note has nothing on screen to open it over, so the app goes behind it.
export const goToNote = (pointer: EventPointer) => {
  const url = withNote(new URL(getHomePath(), page.url), pointer)

  return navigate(url.pathname + url.search, {replaceState: true})
}
