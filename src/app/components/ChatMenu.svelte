<script lang="ts">
  import {assoc} from "@welshman/lib"
  import ChatSquare from "@assets/icons/chat-square.svg?dataurl"
  import Check from "@assets/icons/check.svg?dataurl"
  import Bell from "@assets/icons/bell.svg?dataurl"
  import BellOff from "@assets/icons/bell-off.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import ChatStart from "@app/components/ChatStart.svelte"
  import {setChecked} from "@app/util/notifications"
  import {pushModal} from "@app/util/modal"
  import {notificationSettings} from "@app/core/state"

  const startChat = () => pushModal(ChatStart, {}, {replaceState: true})

  const markAsRead = () => {
    setChecked("/chat/*")
    history.back()
  }

  const enableAlerts = () => notificationSettings.update(assoc("messages", true))

  const disableAlerts = () => notificationSettings.update(assoc("messages", false))
</script>

<div class="col-2">
  <Button class="btn btn-primary" onclick={startChat}>
    <Icon size={5} icon={ChatSquare} />
    Start chat
  </Button>
  <Button class="btn btn-neutral" onclick={markAsRead}>
    <Icon size={5} icon={Check} />
    Mark all read
  </Button>
  {#if $notificationSettings.messages}
    <Button class="btn btn-neutral" onclick={disableAlerts}>
      <Icon size={4} icon={BellOff} />
      Disable alerts
    </Button>
  {:else}
    <Button class="btn btn-neutral" onclick={enableAlerts}>
      <Icon size={4} icon={Bell} />
      Enable alerts
    </Button>
  {/if}
</div>
