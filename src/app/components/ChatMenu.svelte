<script lang="ts">
  import {onMount} from "svelte"
  import {assoc} from "@welshman/lib"
  import {publish} from "@welshman/app"
  import Check from "@assets/icons/check.svg?dataurl"
  import Bell from "@assets/icons/bell.svg?dataurl"
  import BellOff from "@assets/icons/bell-off.svg?dataurl"
  import Mailbox from "@assets/icons/mailbox.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import RelayList from "@app/components/RelayList.svelte"
  import {messagingRelayLists, user} from "@app/core"
  import {pushModal} from "@app/modal"
  import {setChecked} from "@app/notifications"
  import {notificationSettings} from "@app/settings"

  type Props = {
    onClick: () => void
  }

  const {onClick}: Props = $props()

  const markAsRead = () => setChecked("/chat/*")

  const toggleAlerts = () =>
    notificationSettings.update(assoc("messages", !$notificationSettings.messages))

  const showRelays = () =>
    pushModal(RelayList, {
      title: "Messaging Relays",
      subtitle:
        "Where you send and receive direct messages. Be sure to select relays that will accept your messages and messages from people you'd like to be in contact with.",
      relays: $messagingRelayLists.urls($user.pubkey).$,
      addRelay: (url: string) => $messagingRelayLists.addUrl(url).then(publish),
      removeRelay: (url: string) => $messagingRelayLists.removeUrl(url).then(publish),
    })

  let ul: Element

  onMount(() => {
    ul.addEventListener("click", onClick)
  })
</script>

<ul class="menu whitespace-nowrap rounded-2xl bg-surface p-2" bind:this={ul}>
  <li>
    <Button onclick={markAsRead}>
      <Icon size={4} icon={Check} />
      Mark all read
    </Button>
  </li>
  <li>
    <Button onclick={toggleAlerts}>
      {#if $notificationSettings.messages}
        <Icon size={4} icon={BellOff} />
        Disable alerts
      {:else}
        <Icon size={4} icon={Bell} />
        Enable alerts
      {/if}
    </Button>
  </li>
  <li>
    <Button onclick={showRelays}>
      <Icon size={4} icon={Mailbox} />
      Manage Relays
    </Button>
  </li>
</ul>
