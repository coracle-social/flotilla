<script lang="ts">
  import {onMount} from "svelte"
  import Add from "@assets/icons/add.svg?dataurl"
  import Server from "@assets/icons/server.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Link from "@lib/components/Link.svelte"
  import Button from "@lib/components/Button.svelte"
  import HomeSection from "@app/components/HomeSection.svelte"
  import RelayListItem from "@app/components/hosting/RelayListItem.svelte"
  import RelayCreate from "@app/components/hosting/RelayCreate.svelte"
  import {user} from "@app/core"
  import {pushModal} from "@app/modal"
  import {HostingError, listTenantRelays, type HostedRelay} from "@app/hosting"

  let relays = $state<HostedRelay[]>([])
  let loaded = $state(false)

  const openCreate = () => pushModal(RelayCreate)

  // A pubkey with no tenant yet answers with a HostingError, which is the ordinary case for
  // anyone who has never hosted a space. The panel stays out of the way rather than reporting it.
  onMount(async () => {
    try {
      relays = await listTenantRelays($user.pubkey)
      loaded = true
    } catch (e) {
      if (!(e instanceof HostingError)) {
        console.error(e)
      }
    }
  })
</script>

{#if loaded}
  <HomeSection title="Hosting" icon={Server}>
    {#snippet action()}
      {#if relays.length > 0}
        <Link href="/settings/hosting" class="button button-neutral button-xs">Manage</Link>
      {/if}
    {/snippet}
    {#if relays.length > 0}
      <div class="flex flex-col divide-y divide-line border-y border-line">
        {#each relays as relay (relay.id)}
          <RelayListItem {relay} class="px-4 py-3" />
        {/each}
      </div>
    {/if}
    <div class="flex flex-col items-start gap-3 px-4 pt-3 pb-4">
      <p class="text-sm opacity-75">
        {#if relays.length > 0}
          Spin up another hosted space — rooms, calendar and moderation included.
        {:else}
          Don't wait for an invite. Flotilla Hosting sets up a space with rooms, calendar and
          moderation in about a minute.
        {/if}
      </p>
      <Button class="button button-primary button-sm" onclick={openCreate}>
        <Icon icon={Add} size={4} />
        {relays.length > 0 ? "Add another space" : "Start a space"}
      </Button>
    </div>
  </HomeSection>
{/if}
