import {messagingRelayLists} from "@app/core/plugins"
import {user} from "@app/core/user"
import {pushModal} from "@app/navigation/dialogs"
import {goToMessages} from "@app/navigation/history"
import MessagesEnable from "@app/components/MessagesEnable.svelte"

// Messages are read from the user's messaging relays, so they're asked to set some up first.
export const openMessages = (pubkeys: string[] = [], options: {replaceState?: boolean} = {}) => {
  if (messagingRelayLists.get().urls(user.get().pubkey).get().length === 0) {
    pushModal(MessagesEnable, {next: () => goToMessages(pubkeys, options)})
  } else {
    goToMessages(pubkeys, options)
  }
}
