<script lang="ts">
  import SecondaryNavHeader from "@lib/components/SecondaryNavHeader.svelte"
  import SecondaryNavSection from "@lib/components/SecondaryNavSection.svelte"
  import SpaceMenuHeader from "@app/components/SpaceMenuHeader.svelte"
  import SpaceMenuNavItems from "@app/components/SpaceMenuNavItems.svelte"
  import SpaceMenuRooms from "@app/components/SpaceMenuRooms.svelte"
  import Link from "@lib/components/Link.svelte"
  import SocketStatusIndicator from "@app/components/SocketStatusIndicator.svelte"
  import {RelayConnection, deriveSocketStatus} from "@app/relays"
  import {makeSpacePath} from "@app/routes"

  type Props = {
    url: string
    mobile?: boolean
  }

  const {url, mobile = false}: Props = $props()

  const status = deriveSocketStatus(url)

  const statusPath = $derived(
    $status === RelayConnection.SignerFailed ? "/settings/profile" : makeSpacePath(url, "about"),
  )
</script>

<div class="flex min-h-0 flex-1 flex-col">
  {#if mobile}
    <SecondaryNavSection class="space-menu min-h-0 flex-1 flex flex-col gap-3 p-0">
      <div class="card space-menu__card space-menu__header shrink-0 z-nav-item">
        <SpaceMenuHeader {url} mobile />
      </div>
      <div class="space-menu__scroll flex flex-col -mt-12 pt-12 -mb-8 pb-8">
        <div class="card space-menu__card flex flex-col gap-1">
          <SecondaryNavHeader>Space</SecondaryNavHeader>
          <SpaceMenuNavItems {url} />
        </div>
        <SpaceMenuRooms {url} mobile />
      </div>
      <div class="card space-menu__card space-menu__status shrink-0 z-nav-item">
        <Link href={statusPath} class="space-menu__status-link">
          <SocketStatusIndicator {url} />
        </Link>
      </div>
    </SecondaryNavSection>
  {:else}
    <SecondaryNavSection class="min-h-0 flex-1 flex flex-col pb-0">
      <div class="shrink-0">
        <SpaceMenuHeader {url} />
      </div>
      <div
        class="space-menu__scroll flex min-h-0 flex-1 flex-col gap-1 overflow-x-hidden overflow-y-auto py-1">
        <SpaceMenuNavItems {url} />
        <SpaceMenuRooms {url} />
        <div class="h-5 shrink-0"></div>
      </div>
    </SecondaryNavSection>
    <div class="flex shrink-0 flex-col gap-2 p-2 pt-0 -mt-4 pb-1 md:pb-2 z-nav">
      <Link href={statusPath} class="button button-neutral button-sm h-10">
        <SocketStatusIndicator {url} />
      </Link>
    </div>
  {/if}
</div>
