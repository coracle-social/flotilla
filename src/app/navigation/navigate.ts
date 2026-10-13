import {goto} from "$app/navigation"
import {page} from "$app/state"
import {dropModals, historySettled} from "@app/navigation/dialogs"

export type NavigateOptions = Parameters<typeof goto>[1] & {keepModal?: boolean}

// A dialog owns a history entry, which a navigation gives back before pushing its own.
export const navigate = async (path: string, {keepModal, ...options}: NavigateOptions = {}) => {
  await historySettled()

  const ids = page.state.modals ?? []

  if (keepModal && ids.length > 0) {
    return goto(path, {...options, state: {modals: ids}, replaceState: true})
  }

  const dropped = await dropModals()

  return goto(path, {...options, replaceState: options.replaceState && !dropped})
}
