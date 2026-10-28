<script lang="ts">
  import cx from "classnames"
  import {publish} from "@welshman/app"
  import Bell from "@assets/icons/bell.svg?dataurl"
  import Planet from "@assets/icons/planet.svg?dataurl"
  import Settings from "@assets/icons/settings.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import UnderlineTabs from "@lib/components/UnderlineTabs.svelte"
  import type {UnderlineTab} from "@lib/components/UnderlineTabs.svelte"
  import HomeSection from "@app/components/HomeSection.svelte"
  import HomeActivity from "@app/components/HomeActivity.svelte"
  import HomeNetworkRecent from "@app/components/HomeNetworkRecent.svelte"
  import HealthCheckList from "@app/components/HealthCheckList.svelte"
  import PostCreateButton from "@app/components/PostCreateButton.svelte"
  import RelayList from "@app/components/RelayList.svelte"
  import {user} from "@app/core/user"
  import {relayLists} from "@app/core/plugins"
  import {HIDE_NOSTR} from "@app/core/env"
  import {pushModal} from "@app/navigation/dialogs"
  import {homeNotificationsUnread} from "@app/features/activity"

  type HomeTab = "activity" | "network"

  type Props = {
    class?: string
  }

  const {class: className = ""}: Props = $props()

  const tabs: UnderlineTab<HomeTab>[] = $derived([
    {
      value: "activity",
      label: "Recent",
      icon: Bell,
      notification: $homeNotificationsUnread,
    },
    {value: "network", label: "Network", icon: Planet},
  ])

  // The network feed asks every follow's relays for their posts, so it loads when it is asked for.
  let tab = $state<HomeTab>("activity")

  // Once loaded, the network feed stays mounted so switching back finds it where it was left.
  let networkOpened = $state(false)

  $effect(() => {
    if (tab === "network") {
      networkOpened = true
    }
  })

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

<HomeSection title="Recent" class={className}>
  {#snippet nav()}
    <UnderlineTabs options={tabs} bind:value={tab} class="-mb-3 self-stretch" />
  {/snippet}
  {#snippet action()}
    <div class="flex shrink-0 items-center gap-2">
      {#if tab === "network" && !HIDE_NOSTR}
        <Button
          aria-label="Relay settings"
          class="button button-neutral button-xs"
          onclick={showRelays}>
          <Icon icon={Settings} size={4} />
        </Button>
      {/if}
      <PostCreateButton class="max-md:hidden" buttonClass="button button-primary button-xs">
        <span class="hidden @sm:inline">Create post</span>
      </PostCreateButton>
    </div>
  {/snippet}
  <HealthCheckList class="bg-surface-less @3xl:hidden" />
  {#if tab === "activity"}
    <HomeActivity />
  {/if}
  {#if networkOpened}
    <div class={cx({hidden: tab !== "network"})}>
      <HomeNetworkRecent />
    </div>
  {/if}
</HomeSection>
