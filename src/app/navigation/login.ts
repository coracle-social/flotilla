import {writable} from "svelte/store"
import type {Maybe} from "@welshman/lib"

// An action waiting on a login, which the app container answers by opening the login prompt.
export type LoginRequest = {
  action: string
  onLogin: () => unknown
}

export const loginRequest = writable<Maybe<LoginRequest>>()
