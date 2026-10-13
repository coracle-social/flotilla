<script lang="ts">
  import {publish} from "@welshman/app"
  import Planet from "@assets/icons/planet.svg?dataurl"
  import Bell from "@assets/icons/bell.svg?dataurl"
  import PenNewSquare from "@assets/icons/pen-new-square.svg?dataurl"
  import Settings from "@assets/icons/settings.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import UnderlineTabs from "@lib/components/UnderlineTabs.svelte"
  import type {UnderlineTab} from "@lib/components/UnderlineTabs.svelte"
  import HomeSection from "@app/components/HomeSection.svelte"
  import HomeNetworkNotifications from "@app/components/HomeNetworkNotifications.svelte"
  import HomeNetworkRecent from "@app/components/HomeNetworkRecent.svelte"
  import NoteCreate from "@app/components/NoteCreate.svelte"
  import RelayList from "@app/components/RelayList.svelte"
  import {user} from "@app/core/app"
  import {relayLists} from "@app/core/plugins"
  import {pushModal} from "@app/ui/modal"
  import {homeNotificationsUnread} from "@app/ui/notifications"

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

  const showRelays = () =>
    pushModal(RelayList, {
      title: "Your Relays",
      subtitle:
        "Where you publish your notes, and where other people send notes intended for you. Be sure to select relays that will accept your notes and let the people who follow you read them.",
      relays: $relayLists.urls($user.pubkey).$,
      addRelay: (url: string) =>
        $relayLists.update(w => w.addReadUrl(url).addWriteUrl(url)).then(publish),
      removeRelay: (url: string) =>
        $relayLists.update(w => w.removeReadUrl(url).removeWriteUrl(url)).then(publish),
    })
</script>

<HomeSection title="Network" class={className}>
  {#snippet nav()}
    <UnderlineTabs options={tabs} bind:value={tab} class="-mb-3 self-stretch" />
  {/snippet}
  {#snippet action()}
    <div class="flex shrink-0 items-center gap-2">
      <Button
        aria-label="Relay settings"
        class="button button-neutral button-xs"
        onclick={showRelays}>
        <Icon icon={Settings} size={4} />
      </Button>
      <Button aria-label="Create post" class="button button-primary button-xs" onclick={createPost}>
        <Icon icon={PenNewSquare} size={4} />
        <span class="hidden @sm:inline">Create post</span>
      </Button>
    </div>
  {/snippet}
  {#if tab === "recent"}
    <HomeNetworkRecent />
  {:else}
    <HomeNetworkNotifications />
  {/if}
</HomeSection>
