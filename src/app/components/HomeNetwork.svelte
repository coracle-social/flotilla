<script lang="ts">
  import Planet from "@assets/icons/planet.svg?dataurl"
  import Bell from "@assets/icons/bell.svg?dataurl"
  import PenNewSquare from "@assets/icons/pen-new-square.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import UnderlineTabs from "@lib/components/UnderlineTabs.svelte"
  import type {UnderlineTab} from "@lib/components/UnderlineTabs.svelte"
  import HomeSection from "@app/components/HomeSection.svelte"
  import HomeNetworkNotifications from "@app/components/HomeNetworkNotifications.svelte"
  import HomeNetworkRecent from "@app/components/HomeNetworkRecent.svelte"
  import NoteCreate from "@app/components/NoteCreate.svelte"
  import {pushModal} from "@app/modal"
  import {homeNotificationsUnread} from "@app/notifications"

  type NetworkTab = "recent" | "notifications"

  type Props = {
    class?: string
  }

  const {class: className = ""}: Props = $props()

  const tabs: UnderlineTab<NetworkTab>[] = $derived([
    {value: "recent", label: "Network", icon: Planet},
    {
      value: "notifications",
      label: "Notifications",
      icon: Bell,
      notification: $homeNotificationsUnread,
    },
  ])

  let tab = $state<NetworkTab>("recent")

  const createPost = () => pushModal(NoteCreate)
</script>

<HomeSection title="Network" class={className}>
  {#snippet nav()}
    <UnderlineTabs options={tabs} bind:value={tab} class="-mb-3 self-stretch" />
  {/snippet}
  {#snippet action()}
    <Button aria-label="Create post" class="button button-primary button-xs" onclick={createPost}>
      <Icon icon={PenNewSquare} size={4} />
      <span class="hidden @sm:inline">Create post</span>
    </Button>
  {/snippet}
  {#if tab === "recent"}
    <HomeNetworkRecent />
  {:else}
    <HomeNetworkNotifications />
  {/if}
</HomeSection>
