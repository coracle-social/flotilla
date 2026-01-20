<script lang="ts">
  import ChatSquare from "@assets/icons/chat-square.svg?dataurl"
  import Check from "@assets/icons/check.svg?dataurl"
  import Bell from "@assets/icons/bell.svg?dataurl"
  import BellOff from "@assets/icons/bell-off.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import ChatStart from "@app/components/ChatStart.svelte"
  import {setChecked} from "@app/util/notifications"
  import {pushModal} from "@app/util/modal"
  import {userSettingsValues} from "@app/core/state"
  import {publishSettings} from "@app/core/commands"

  const startChat = () => pushModal(ChatStart, {}, {replaceState: true})

  const markAsRead = () => {
    setChecked("/chat/*")
    history.back()
  }

  const enableAlerts = () => publishSettings({...$userSettingsValues, alerts_messages: true})

  const disableAlerts = () => publishSettings({...$userSettingsValues, alerts_messages: false})
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
  {#if $userSettingsValues.alerts_messages}
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
