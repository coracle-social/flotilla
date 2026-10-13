<script lang="ts">
  import Add from "@assets/icons/add.svg?dataurl"
  import Server from "@assets/icons/server.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Link from "@lib/components/Link.svelte"
  import Button from "@lib/components/Button.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import HomeSection from "@app/components/HomeSection.svelte"
  import RelayListItem from "@app/components/hosting/RelayListItem.svelte"
  import RelayCreate from "@app/components/hosting/RelayCreate.svelte"
  import {pushModal} from "@app/ui/modal"
  import {hosting} from "@app/features/hosting"
  import {PLATFORM_NAME} from "@app/core/env"

  type Props = {
    class?: string
  }

  const {class: className = ""}: Props = $props()

  const tenantRelays = $hosting.relays

  const relays = $derived($tenantRelays.value)

  const openCreate = () => pushModal(RelayCreate)
</script>

<HomeSection title="Hosting" icon={Server} class={className}>
  {#snippet action()}
    {#if relays.length > 0}
      <Link href="/settings/hosting" class="button button-neutral button-xs">Manage</Link>
    {/if}
  {/snippet}
  {#if $tenantRelays.loading}
    <div class="flex justify-center px-4 pb-8">
      <Spinner>Checking your hosted spaces…</Spinner>
    </div>
  {:else}
    {#if relays.length > 0}
      <div class="flex flex-col divide-y divide-line border-y border-line">
        {#each relays as relay (relay.id)}
          <RelayListItem {relay} compact class="px-4 py-3" />
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
