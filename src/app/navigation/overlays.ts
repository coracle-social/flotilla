import {EventRef} from "@welshman/util"
import type {IEventRef, TrustedEvent} from "@welshman/util"
import {goto, pushState, replaceState} from "$app/navigation"
import {page} from "$app/state"
import {app} from "@app/core/app"
import {popHistory, traverse} from "@app/navigation/dialogs"
import {getHomePath} from "@app/navigation/history"
import {navigate} from "@app/navigation/navigate"

// A note opens over the page with its pointer in the url, so it survives a reload and can be shared.
const withNote = (url: URL, nevent?: string) => {
  const next = new URL(url)

  if (nevent) {
    next.searchParams.set("note", nevent)
  } else {
    next.searchParams.delete("note")
  }

  return next
}

// A note opened from the screen is in hand, so its overlay doesn't wait on a repository read.
let openedNote: {key: string; event: TrustedEvent} | undefined

// Shallow routing keeps page.url at the page's own url, so only a real load reads the note from it.
export const getNoteOverlay = () => {
  const nevent = page.state.note ?? page.url.searchParams.get("note")
  const ref = nevent ? EventRef.fromNip19(nevent) : undefined

  if (ref) {
    const key = ref.getIdOrAddress()
    const event = key && openedNote?.key === key ? openedNote.event : undefined

    return {ref, reply: Boolean(page.state.reply), event}
  }
}

export type OpenNoteOptions = {
  reply?: boolean
  replaceState?: boolean
  event?: TrustedEvent
}

// The note covers any dialog that was open, which comes back once the note is closed.
export const openNote = (ref: IEventRef, options: OpenNoteOptions = {}) =>
  traverse(() => {
    const note = new EventRef(ref).toNip19()
    const key = new EventRef(ref).getIdOrAddress()
    const url = withNote(page.url, note)
    const state = {...page.state, modals: [], note, reply: options.reply}

    if (key && options.event) {
      openedNote = {key, event: options.event}
    }

    if (options.replaceState) {
      replaceState(url, {...state, ownsNote: Boolean(page.state.ownsNote)})
    } else {
      pushState(url, {...state, ownsNote: true})
    }
  })

// An event already on screen opens as a note, pointed at the relays it was seen on.
export const openEventNote = (event: TrustedEvent, options: OpenNoteOptions = {}) =>
  openNote(
    EventRef.fromEvent(event, Array.from(app.get().repository.tracker.getRelays(event.id))),
    {...options, event},
  )

// A note opened by a link or a reload has no entry of its own, so closing it reloads the page without it.
export const closeNote = () =>
  traverse(async () => {
    openedNote = undefined

    if (page.state.ownsNote) {
      await popHistory()
    } else {
      await goto(withNote(page.url), {replaceState: true, noScroll: true, keepFocus: true})
    }
  })

// A url resolving to a note has nothing on screen to open it over, so the app goes behind it.
export const goToNote = (ref: IEventRef) => {
  const url = withNote(new URL(getHomePath(), page.url), new EventRef(ref).toNip19())

  return navigate(url.pathname + url.search, {replaceState: true})
}
