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

// Modal ids live in SvelteKit page state, so a `goto` that drops `state` closes them.
export const getModalStack = () => (page.state.modals ?? []).map(id => modals[id]).filter(Boolean)

export const getModal = () => last(getModalStack())

export type NavigateOptions = Parameters<typeof goto>[1] & {keepModal?: boolean}

const popHistory = () =>
  new Promise(resolve => {
    addEventListener("popstate", resolve, {once: true})

    history.back()
  })

// SvelteKit reuses its navigation index for a replacing `goto`, so entries are given back instead.
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
