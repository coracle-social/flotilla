<script lang="ts">
  import {onMount} from "svelte"
  import Add from "@assets/icons/add.svg?dataurl"
  import Server from "@assets/icons/server.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Link from "@lib/components/Link.svelte"
  import Button from "@lib/components/Button.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import HomeSection from "@app/components/HomeSection.svelte"
  import RelayListItem from "@app/components/hosting/RelayListItem.svelte"
  import RelayCreate from "@app/components/hosting/RelayCreate.svelte"
  import {user} from "@app/core"
  import {pushModal} from "@app/modal"
  import {HostingError, listTenantRelays, type HostedRelay} from "@app/hosting"
  import {PLATFORM_NAME} from "@app/env"

  const {class: className = ""}: {class?: string} = $props()

  let relays = $state<HostedRelay[]>([])
  let loading = $state(true)

  const openCreate = () => pushModal(RelayCreate)

  // A pubkey with no tenant yet answers with a HostingError, which is the ordinary case for
  // anyone who has never hosted a space.
  onMount(async () => {
    try {
      relays = await listTenantRelays($user.pubkey)
    } catch (e) {
      if (!(e instanceof HostingError)) {
        console.error(e)
      }
    } finally {
      loading = false
    }
  })
</script>

<HomeSection title="Hosting" icon={Server} class={className}>
  {#snippet action()}
    {#if relays.length > 0}
      <Link href="/settings/hosting" class="button button-neutral button-xs">Manage</Link>
    {/if}
  {/snippet}
  {#if loading}
    <div class="flex justify-center px-4 pb-8">
      <Spinner>Checking your hosted spaces…</Spinner>
    </div>
  {:else}
    {#if relays.length > 0}
      <div class="flex flex-col divide-y divide-line border-y border-line">
        {#each relays as relay (relay.id)}
          <RelayListItem {relay} class="px-4 py-3" />
        {/each}
      </div>
    {/if}
    <div class="flex flex-col items-center gap-3 px-4 pt-4 pb-8 text-center">
      <p class="text-sm opacity-75">
        {#if relays.length > 0}
          Spin up another hosted space — rooms, calendar and moderation included.
        {:else}
          Don't wait for an invite. {PLATFORM_NAME} Hosting sets up a space with rooms, calendar and moderation
          in about a minute.
        {/if}
      </p>
      <Button class="button button-primary button-sm" onclick={openCreate}>
        <Icon icon={Add} size={4} />
        {relays.length > 0 ? "Add another space" : "Start a space"}
      </Button>
    </div>
  {/if}
</HomeSection>
