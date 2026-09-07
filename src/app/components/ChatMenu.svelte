<script lang="ts">
  import {onMount} from "svelte"
  import {assoc} from "@welshman/lib"
  import Check from "@assets/icons/check.svg?dataurl"
  import Bell from "@assets/icons/bell.svg?dataurl"
  import BellOff from "@assets/icons/bell-off.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import {setChecked} from "@app/notifications"
  import {notificationSettings} from "@app/settings"

  type Props = {
    onClick: () => void
  }

  const {onClick}: Props = $props()

  const markAsRead = () => setChecked("/chat/*")

  const toggleAlerts = () =>
    notificationSettings.update(assoc("messages", !$notificationSettings.messages))

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
</ul>
