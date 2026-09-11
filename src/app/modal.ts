import type {Component} from "svelte"
import {randomId, Emitter} from "@welshman/lib"
import {goto, pushState, replaceState} from "$app/navigation"
import {page} from "$app/state"
import {modals, type ModalOptions} from "@app/modal.svelte"

export const emitter = new Emitter()

export type NavigateOptions = Parameters<typeof goto>[1] & {keepModal?: boolean}

// An open modal owns the current history entry, so a navigation that drops it takes that entry over
export const navigate = (path: string, {keepModal, ...options}: NavigateOptions = {}) => {
  const ids = page.state.modals ?? []
  const modalIsOpen = ids.length > 0

  if (keepModal && modalIsOpen) {
    return goto(path, {...options, state: {modals: ids}, replaceState: true})
  }

  return goto(path, {...options, replaceState: options.replaceState || modalIsOpen})
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
