import type {Component} from "svelte"
import {last} from "@welshman/lib"
import {page} from "$app/state"
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

export const modals = $state<Record<string, Modal>>({})

// Open modal ids live in SvelteKit's page state (shallow routing): each modal owns a history entry
// without a navigation, and any `goto` that doesn't pass `state` along closes them.
const modalStack = $derived((page.state.modals ?? []).map(id => modals[id]).filter(Boolean))

export const getModalStack = () => modalStack

export const getModal = () => last(modalStack)
