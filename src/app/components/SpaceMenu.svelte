<script lang="ts">
  import SecondaryNavHeader from "@lib/components/SecondaryNavHeader.svelte"
  import SecondaryNavSection from "@lib/components/SecondaryNavSection.svelte"
  import SpaceMenuHeader from "@app/components/SpaceMenuHeader.svelte"
  import SpaceMenuNavItems from "@app/components/SpaceMenuNavItems.svelte"
  import SpaceMenuRooms from "@app/components/SpaceMenuRooms.svelte"

  type Props = {
    url: string
    mobile?: boolean
  }

  const {url, mobile = false}: Props = $props()
</script>

<div class="flex min-h-0 flex-1 flex-col">
  {#if mobile}
    <SecondaryNavSection class="space-menu min-h-0 flex-1 flex flex-col gap-3 p-0">
      <div class="card space-menu__card space-menu__header shrink-0 z-nav-item">
        <SpaceMenuHeader {url} mobile />
      </div>
      <div class="space-menu__scroll flex flex-col -mt-12 pt-12">
        <div class="card space-menu__card flex flex-col gap-1">
          <SecondaryNavHeader>Space</SecondaryNavHeader>
          <SpaceMenuNavItems {url} />
        </div>
        <SpaceMenuRooms {url} mobile />
      </div>
    </SecondaryNavSection>
  {:else}
    <SecondaryNavSection class="min-h-0 flex-1 flex flex-col">
      <div class="shrink-0">
        <SpaceMenuHeader {url} />
      </div>
      <div
        class="space-menu__scroll flex min-h-0 flex-1 flex-col gap-1 overflow-x-hidden overflow-y-auto py-1">
        <SpaceMenuNavItems {url} />
        <SpaceMenuRooms {url} />
      </div>
    </SecondaryNavSection>
  {/if}
</div>
