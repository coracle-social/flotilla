import {writable} from "svelte/store"
import type {Maybe} from "@welshman/lib"
import type {TrustedEvent} from "@welshman/util"
import {navigate} from "@app/navigation/navigate"

export type Share =
  | {type: "event"; value: TrustedEvent}
  | {type: "text"; value: string}
  | {type: "file"; value: File}

export const pendingShare = writable<Maybe<{path: string; share: Share}>>(undefined)

// Set pendingShare after navigating so the current view doesn't pop it
export const shareTo = async (
  path: string,
  share: Share,
  options: {replaceState?: boolean} = {},
) => {
  await navigate(path, options)

  pendingShare.set({path, share})
}
