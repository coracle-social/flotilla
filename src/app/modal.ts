import type {Component} from "svelte"
import {get, writable} from "svelte/store"
import {randomId, always, assoc, Emitter} from "@welshman/lib"
import {deriveDeduplicated} from "@welshman/store"
import {goto} from "$app/navigation"
import {page} from "$app/stores"
import type {DialogSize} from "@lib/components/Dialog.svelte"

export type ModalOptions = {
  drawer?: boolean
  nested?: boolean
  noEscape?: boolean
  fullscreen?: boolean
  size?: DialogSize
  replaceState?: boolean
  path?: string
}

export type Modal = {
  id: string
  component: Component
  props: Record<string, any>
  options: ModalOptions
}

export const emitter = new Emitter()

export const modals = writable<Record<string, Modal>>({})

const getIdsFromHash = (hash: string) => hash.slice(1).split(",").filter(Boolean)

// The modal stack lives in the url hash, but it is written with the History API directly rather
// than SvelteKit's `goto`. A programmatic hash `goto` runs a full navigation, which re-renders the
// whole layout tree and (in dev) leaves a second, orphaned app shell mounted; a History update does
// not navigate. `history.state` is carried through untouched, so SvelteKit's own popstate handler
// treats a back as a same-entry hash change and does nothing, while this store drives the open
// modals.
const modalHash = writable(typeof location === "undefined" ? "" : location.hash)

if (typeof window !== "undefined") {
  window.addEventListener("popstate", () => modalHash.set(location.hash))

  // Close modals on navigate
  page.subscribe($page => modalHash.set($page.url?.hash ?? ""))
}

const setModalHash = (hash: string, replace: boolean) => {
  const {pathname, search} = get(page).url
  const url = pathname + search + hash

  if (replace) {
    history.replaceState(history.state, "", url)
  } else {
    history.pushState(history.state, "", url)
  }

  modalHash.set(hash)
}

// An open modal owns the current history entry, so a navigation that drops it takes that entry over
const closesModal = (path: string) => {
  const hash = get(modalHash)

  return hash !== "" && !path.endsWith(hash)
}

export const navigate = (path: string, options?: Parameters<typeof goto>[1]) =>
  goto(path, {...options, replaceState: options?.replaceState || closesModal(path)})

export const modalStack = deriveDeduplicated([modalHash, modals], ([$hash, $modals]) => {
  return getIdsFromHash($hash)
    .map(id => $modals[id])
    .filter(Boolean)
})

export const modal = deriveDeduplicated([modalHash, modals], ([$hash, $modals]) => {
  const ids = getIdsFromHash($hash)

  return $modals[ids.at(-1) || ""]
})

export const pushModal = (
  component: Component<any>,
  props: Record<string, any> = {},
  options: ModalOptions = {},
) => {
  const id = randomId()
  const existingIds = getIdsFromHash(get(modalHash))
  const ids = options.nested ? [...existingIds, id] : [id]

  modals.update(assoc(id, {id, component, props, options}))

  setModalHash("#" + ids.join(","), Boolean(options.replaceState))

  return id
}

export const pushDrawer = (
  component: Component<any>,
  props: Record<string, any> = {},
  options: ModalOptions = {},
) => pushModal(component, props, {...options, drawer: true})

export const popModal = () => {
  const ids = getIdsFromHash(get(modalHash))

  if (ids.length === 0) {
    return
  }

  const next = ids.slice(0, -1).join(",")

  setModalHash(next ? `#${next}` : "", true)
}

export const clearModals = () => {
  setModalHash("", true)
  modals.update(always({}))
  emitter.emit("close")
}
