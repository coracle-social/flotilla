import type {Component} from "svelte"
import {last, ms, noop, randomId} from "@welshman/lib"
import {pushState, replaceState} from "$app/navigation"
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
}

export type Modal = {
  id: string
  component: Component<any>
  props: Record<string, any>
  options: ModalOptions
  // Opening it pushed a history entry, so closing it goes back over that entry.
  ownsEntry: boolean
}

const modals: Record<string, Modal> = {}

// History moves land asynchronously, so each one waits for the move before it.
let traversal: Promise<unknown> = Promise.resolve()

export const traverse = <T>(step: () => T | Promise<T>) => {
  const next = traversal.then(step)

  traversal = next.catch(noop)

  return next
}

export const historySettled = () => traverse(noop)

// Modal ids live in SvelteKit page state, so a `goto` that drops `state` closes them.
export const getModalStack = () => (page.state.modals ?? []).map(id => modals[id]).filter(Boolean)

export const getModal = () => last(getModalStack())

// A back with nothing left to pop fires no popstate, so the wait for one is bounded.
export const popHistory = () =>
  new Promise<boolean>(resolve => {
    const finish = (popped: boolean) => {
      clearTimeout(timeout)
      removeEventListener("popstate", onPopState)
      resolve(popped)
    }

    const onPopState = () => finish(true)
    const timeout = setTimeout(() => finish(false), ms(1))

    addEventListener("popstate", onPopState)
    history.back()
  })

// Gives back the entries dialogs pushed, then clears any dialog that took over the page's own entry.
export const dropModals = () =>
  traverse(async () => {
    let dropped = false

    while (getModal()?.ownsEntry && (await popHistory())) {
      dropped = true
    }

    if (getModalStack().length > 0) {
      replaceState("", {...page.state, modals: []})
    }

    return dropped
  })

export const pushModal = (
  component: Component<any>,
  props: Record<string, any> = {},
  options: ModalOptions = {},
) => {
  const id = randomId()

  traverse(() => {
    const ids = options.nested ? [...(page.state.modals ?? []), id] : [id]

    // A dialog swapped in for another takes over its entry, while one swapped onto the page's own has none.
    const ownsEntry = options.replaceState
      ? !options.nested && Boolean(getModal()?.ownsEntry)
      : true

    modals[id] = {id, component, props, options, ownsEntry}

    if (options.replaceState) {
      replaceState("", {...page.state, modals: ids})
    } else {
      pushState("", {...page.state, modals: ids})
    }
  })

  return id
}

export const popModal = () =>
  traverse(async () => {
    const modal = getModal()

    if (modal?.ownsEntry) {
      await popHistory()
    } else if (modal) {
      replaceState("", {...page.state, modals: (page.state.modals ?? []).slice(0, -1)})
    }
  })

export const clearModals = async () => {
  await dropModals()

  for (const id of Object.keys(modals)) {
    delete modals[id]
  }
}
