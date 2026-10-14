import * as nip19 from "nostr-tools/nip19"
import type {EventPointer} from "nostr-tools/nip19"
import type {TrustedEvent} from "@welshman/util"
import {goto, pushState, replaceState} from "$app/navigation"
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

// Shallow routing keeps page.url at the page's own url, so only a real load reads the note from it.
export const getNoteOverlay = () => {
  const nevent = page.state.note ?? page.url.searchParams.get("note")
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
    const note = nip19.neventEncode(pointer)
    const state = {...page.state, modals: [], note, reply: options.reply}

    if (options.replaceState) {
      replaceState(url, {...state, ownsNote: false})
    } else {
      pushState(url, {...state, ownsNote: true})
    }
  })

// An event already on screen opens as a note, pointed at the relays it was seen on.
export const openEventNote = (event: TrustedEvent, options: OpenNoteOptions = {}) =>
  openNote(
    {id: event.id, author: event.pubkey, relays: Array.from(app.get().tracker.getRelays(event.id))},
    options,
  )

// A note opened by a link or a reload has no entry of its own, so closing it reloads the page without it.
export const closeNote = () =>
  traverse(async () => {
    if (page.state.ownsNote) {
      await popHistory()
    } else {
      await goto(withNote(page.url), {replaceState: true, noScroll: true, keepFocus: true})
    }
  })

// A url resolving to a note has nothing on screen to open it over, so the app goes behind it.
export const goToNote = (pointer: EventPointer) => {
  const url = withNote(new URL(getHomePath(), page.url), pointer)

  return navigate(url.pathname + url.search, {replaceState: true})
}
