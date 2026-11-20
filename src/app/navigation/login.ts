import {writable} from "svelte/store"
import type {Maybe} from "@welshman/lib"

// A request to log in, which the app container answers by opening the login dialog.
export type LoginRequest = {
  onLogin?: () => unknown
}

export const loginRequest = writable<Maybe<LoginRequest>>()
