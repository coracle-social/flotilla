<script lang="ts">
  import {derived} from "svelte/store"
  import Server from "@assets/icons/server.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Link from "@lib/components/Link.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import PageContent from "@lib/components/PageContent.svelte"
  import SpaceBar from "@app/components/SpaceBar.svelte"
  import RelayDetailCard from "@app/components/hosting/RelayDetailCard.svelte"
  import ActivityFeed from "@app/components/hosting/ActivityFeed.svelte"
  import {deriveHostedRelay, deriveRelayActivity} from "@app/hosting"
  import {decodeRelay} from "@app/relays"
  import type {PageProps} from "./$types"

  const {params}: PageProps = $props()

  const url = decodeRelay(params.relay)
  const hostedRelay = deriveHostedRelay(url)
  const relayActivity = deriveRelayActivity(derived(hostedRelay, $h => $h.relay?.id))
</script>

<SpaceBar>
  {#snippet leading()}
    <Icon icon={Server} />
  {/snippet}
  {#snippet title()}
    <strong>Hosting settings</strong>
  {/snippet}
</SpaceBar>

<PageContent class="flex flex-col gap-4 p-4">
  {#if $hostedRelay.relay}
    <RelayDetailCard relay={$hostedRelay.relay} />
    <ActivityFeed activity={$relayActivity.activity} loading={$relayActivity.loading} />
  {:else if $hostedRelay.loading}
    <div class="flex justify-center p-12">
      <Spinner>Loading hosting details...</Spinner>
    </div>
  {:else}
    <div class="card flex flex-col items-center gap-4 p-8 text-center">
      <Icon icon={Server} size={10} class="text-content-muted" />
      <div class="flex flex-col gap-1">
        <h2 class="text-lg font-bold">Not a Coracle-hosted space</h2>
        <p class="text-sm text-content-muted">
          This space isn't hosted by Coracle Hosting, or you don't administer it. Only the owner of
          a hosted relay can manage its plan, policies, and billing here.
        </p>
      </div>
      <Link class="button button-neutral" href="/settings/hosting">Go to Hosting settings</Link>
    </div>
  {/if}
</PageContent>
