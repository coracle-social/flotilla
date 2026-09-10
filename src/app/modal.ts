import type {Component} from "svelte"
import {get, writable} from "svelte/store"
import {randomId, last, call, always, assoc, Emitter} from "@welshman/lib"
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

export const getIdsFromHash = (hash: string) => hash.slice(1).split(",").filter(Boolean)

export const modalHash = writable("")

export const modalStack = deriveDeduplicated([modalHash, modals], ([$hash, $modals]) => {
  return getIdsFromHash($hash)
    .map(id => $modals[id])
    .filter(Boolean)
})

export const modal = deriveDeduplicated(modalStack, last)

// Base push which handles both modals and paths

export type PushParams = {
  pathname?: string
  search?: string
  hash?: string
}

export type PushOptions = Parameters<typeof goto>[1]

export const push = (params: PushParams, options: PushOptions) => {
  const $page = get(page)
  const $pathname = params.pathname ?? $page.url.pathname
  const $search = params.search ?? $page.url.search
  const $hash = params.hash ?? $page.url.hash
  const url = $pathname + $search + $hash

  if (params.pathname !== $page.url.pathname) {
    goto(url, options)
  } else if (options.replaceState) {
    history.replaceState(history.state, "", url)
  } else {
    history.pushState(history.state, "", url)
  }
}

export const pop = () => history.back()

// push/pop path, for navigations that clear modals and query params

export const pushPath = (pathname: string, options: PushOptions) =>
  push({pathname, search: "", hash: ""}, options)

export const popPath = async () => {
  while (get(modal)) {
    await history.back()
  }
}

// push/pop/clear modal

export const pushModal = (
  component: Component<any>,
  props: Record<string, any> = {},
  options: ModalOptions = {},
) => {
  const id = randomId()
  const existingIds = getIdsFromHash(get(modalHash))
  const ids = options.nested ? [...existingIds, id] : [id]

  modals.update(assoc(id, {id, component, props, options}))

  push({
    hash: "#" + ids.join(","),
  }, {
    replaceState: Boolean(options.replaceState),
  })

  return id
}

export const popModal = () => {
  const ids = getIdsFromHash(get(modalHash))

  if (ids.length === 0) {
    return
  }

  const next = ids.slice(0, -1).join(",")

  push({
    hash: next ? `#${next}` : "",
  }, {
    replaceState: true,
  })
}

export const clearModals = () => {
  push({hash: ""}, {replaceState: true})
  modals.update(always({}))
  emitter.emit("close")
}

// Sync window history with the current hash directly. Svelte's navigation stuff
// is buggy, and results in double-mounted pages in dev.
call(() => {
  window.addEventListener("popstate", () => modalHash.set(location.hash))
  page.subscribe($page => modalHash.set($page.url?.hash ?? ""))
})
