<script lang="ts">
  import {displayRelayUrl} from "@welshman/util"
  import Home from "@assets/icons/home.svg?dataurl"
  import ShieldUser from "@assets/icons/shield-user.svg?dataurl"
  import BillList from "@assets/icons/bill-list.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Link from "@lib/components/Link.svelte"
  import PageContent from "@lib/components/PageContent.svelte"
  import SpaceBar from "@app/components/SpaceBar.svelte"
  import RelayIcon from "@app/components/RelayIcon.svelte"
  import RelayName from "@app/components/RelayName.svelte"
  import RelayDescription from "@app/components/RelayDescription.svelte"
  import SpaceDirectory from "@app/components/SpaceDirectory.svelte"
  import {relays} from "@app/core/plugins"
  import * as pages from "@app/navigation/pages"
  import type {PageProps} from "./$types"

  const {params}: PageProps = $props()

  const {url} = pages.spaceAbout.decode(params)
  const relay = $relays.one(url)
</script>

<SpaceBar>
  {#snippet leading()}
    <Icon icon={Home} />
  {/snippet}
  {#snippet title()}
    <strong>About</strong>
  {/snippet}
</SpaceBar>

<PageContent class="@container flex flex-col gap-4 p-4">
  <div class="card flex flex-col gap-4">
    <div class="relative flex gap-4">
      <div class="relative">
        <RelayIcon {url} size={14} />
      </div>
      <div class="flex min-w-0 flex-col">
        <h1 class="truncate min-w-0 whitespace-nowrap">
          <RelayName {url} class="text-xl sm:text-2xl font-bold" />
        </h1>
        <p class="truncate min-w-0 text-sm text-primary">{displayRelayUrl(url)}</p>
      </div>
    </div>
    <RelayDescription {url} />
    {#if $relay?.terms_of_service || $relay?.privacy_policy}
      <div class="flex gap-3">
        {#if $relay.terms_of_service}
          <Link href={$relay.terms_of_service} class="badge badge-neutral flex gap-2">
            <Icon icon={BillList} size={4} />
            Terms of Service
          </Link>
        {/if}
        {#if $relay.privacy_policy}
          <Link href={$relay.privacy_policy} class="badge badge-neutral flex gap-2">
            <Icon icon={ShieldUser} size={4} />
            Privacy Policy
          </Link>
        {/if}
      </div>
    {/if}
  </div>
  <SpaceDirectory {url} />
</PageContent>
