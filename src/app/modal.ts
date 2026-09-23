import type {Component} from "svelte"
import {randomId, last, Emitter} from "@welshman/lib"
import {goto, pushState, replaceState} from "$app/navigation"
import {page} from "$app/state"
import type {DialogSize} from "@lib/components/Dialog.svelte"

export type ModalOptions = {
  drawer?: boolean
  label?: string
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

const modals: Record<string, Modal> = {}

// Open modal ids live in SvelteKit page state (shallow routing): each modal owns a history entry
// without a navigation, and any `goto` that does not pass `state` along closes them.
export const getModalStack = () => (page.state.modals ?? []).map(id => modals[id]).filter(Boolean)

export const getModal = () => last(getModalStack())

export type NavigateOptions = Parameters<typeof goto>[1] & {keepModal?: boolean}

const popHistory = () =>
  new Promise(resolve => {
    addEventListener("popstate", resolve, {once: true})

    history.back()
  })

// Each open modal owns a history entry, and a navigation that drops them gives those entries back
// rather than replacing them. SvelteKit reuses its navigation index for a `goto` that replaces, and
// a back out of the new page would then match the entry underneath and update the url without
// rendering it.
const dropModalEntries = async () => {
  let dropped = false

  while (getModalStack().length > 0) {
    await popHistory()

    dropped = true
  }

  return dropped
}

export const navigate = async (path: string, {keepModal, ...options}: NavigateOptions = {}) => {
  const ids = page.state.modals ?? []

  if (keepModal && ids.length > 0) {
    return goto(path, {...options, state: {modals: ids}, replaceState: true})
  }

  const dropped = await dropModalEntries()

  return goto(path, {...options, replaceState: options.replaceState && !dropped})
}

export const pushModal = (
  component: Component<any>,
  props: Record<string, any> = {},
  options: ModalOptions = {},
) => {
  const id = randomId()
  const ids = options.nested ? [...(page.state.modals ?? []), id] : [id]

  modals[id] = {id, component, props, options}

  if (options.replaceState) {
    replaceState("", {modals: ids})
  } else {
    pushState("", {modals: ids})
  }

  return id
}

export const popModal = () => {
  const ids = page.state.modals ?? []

  if (ids.length > 0) {
    replaceState("", {modals: ids.slice(0, -1)})
  }
}

export const clearModals = () => {
  replaceState("", {})

  for (const id of Object.keys(modals)) {
    delete modals[id]
  }

  emitter.emit("close")
}
