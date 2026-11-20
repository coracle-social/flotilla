import {messagingRelayLists} from "@app/core/plugins"
import {requireUser} from "@app/core/user"
import {pushModal} from "@app/navigation/dialogs"
import {goToMessages} from "@app/navigation/history"
import MessagesEnable from "@app/components/MessagesEnable.svelte"
import {withLogin} from "@app/components/flows/login"

// Messages are read from the user's messaging relays, so they're asked to set some up first.
export const openMessages = (pubkeys: string[] = [], options: {replaceState?: boolean} = {}) =>
  withLogin(() => {
    if (messagingRelayLists.get().urls(requireUser().pubkey).get().length === 0) {
      pushModal(MessagesEnable, {next: () => goToMessages(pubkeys, options)})
    } else {
      goToMessages(pubkeys, options)
    }
  })
