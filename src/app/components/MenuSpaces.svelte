<script lang="ts">
  import Compass from "@assets/icons/compass.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Link from "@lib/components/Link.svelte"
  import Divider from "@lib/components/Divider.svelte"
  import CardButton from "@lib/components/CardButton.svelte"
  import MenuSpacesItem from "@app/components/MenuSpacesItem.svelte"
  import {userRoomsByUrl, PLATFORM_RELAYS} from "@app/core/state"
</script>

<div class="column menu gap-2">
  {#each PLATFORM_RELAYS as url (url)}
    <MenuSpacesItem {url} />
  {:else}
    {#if $userRoomsByUrl.size > 0}
      {#each $userRoomsByUrl.keys() as url (url)}
        <MenuSpacesItem {url} />
      {/each}
      <Divider />
    {/if}
    <Link href="/discover">
      <CardButton class="btn-neutral">
        {#snippet icon()}
          <div><Icon icon={Compass} size={7} /></div>
        {/snippet}
        {#snippet title()}
          <div>Explore Spaces</div>
        {/snippet}
        {#snippet info()}
          <div>Join create, or browse spaces</div>
        {/snippet}
      </CardButton>
    </Link>
  {/each}
</div>
