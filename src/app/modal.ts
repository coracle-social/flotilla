import type {Component} from "svelte"
import {get, writable} from "svelte/store"
import {randomId, last, always, assoc, Emitter} from "@welshman/lib"
import {deriveDeduplicated} from "@welshman/store"
import {goto, pushState, replaceState} from "$app/navigation"
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

// Open modal ids live in SvelteKit's page state (shallow routing): each modal owns a history entry
// without a navigation, and any `goto` that doesn't pass `state` along closes them.
export const modalStack = deriveDeduplicated([page, modals], ([$page, $modals]) =>
  ($page.state?.modals ?? []).map(id => $modals[id]).filter(Boolean),
)

export const modal = deriveDeduplicated(modalStack, last)

export type NavigateOptions = Parameters<typeof goto>[1] & {keepModal?: boolean}

// An open modal owns the current history entry, so a navigation that drops it takes that entry over
export const navigate = (path: string, {keepModal, ...options}: NavigateOptions = {}) => {
  const {state} = get(page)
  const modalIsOpen = Boolean(state.modals?.length)

  if (keepModal && modalIsOpen) {
    return goto(path, {...options, state, replaceState: true})
  }

  return goto(path, {...options, replaceState: options.replaceState || modalIsOpen})
}

export const pop = () => history.back()

export const popPath = async () => {
  while (get(modal)) {
    const popped = new Promise(resolve =>
      window.addEventListener("popstate", resolve, {once: true}),
    )

    history.back()

    await popped
  }
}

export const pushModal = (
  component: Component<any>,
  props: Record<string, any> = {},
  options: ModalOptions = {},
) => {
  const id = randomId()
  const existingIds = get(page).state.modals ?? []
  const ids = options.nested ? [...existingIds, id] : [id]

  modals.update(assoc(id, {id, component, props, options}))

  if (options.replaceState) {
    replaceState("", {modals: ids})
  } else {
    pushState("", {modals: ids})
  }

  return id
}

export const popModal = () => {
  const ids = get(page).state.modals ?? []

  if (ids.length > 0) {
    replaceState("", {modals: ids.slice(0, -1)})
  }
}

export const clearModals = () => {
  replaceState("", {})
  modals.update(always({}))
  emitter.emit("close")
}
