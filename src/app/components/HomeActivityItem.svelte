<script lang="ts">
  import HomeActivityItemRow from "@app/components/HomeActivityItemRow.svelte"
  import HomeActivityItemConversation from "@app/components/HomeActivityItemConversation.svelte"
  import RelayIcon from "@app/components/RelayIcon.svelte"
  import RelayName from "@app/components/RelayName.svelte"
  import RoomName from "@app/components/RoomName.svelte"
  import type {Activity} from "@app/features/notifications"

  type Props = {
    activity: Activity
  }

  const {activity}: Props = $props()

  const {path, url, h, pubkeys = [], event} = $derived(activity)
</script>

{#if url}
  <HomeActivityItemRow {path} {url} {event}>
    {#snippet icon()}
      <RelayIcon {url} size={9} class="shrink-0" />
    {/snippet}
    {#snippet title()}
      {#if h}
        <RoomName {url} {h} />
      {:else}
        Chat
      {/if}
    {/snippet}
    {#snippet subtitle()}
      <RelayName {url} />
    {/snippet}
  </HomeActivityItemRow>
{:else}
  <HomeActivityItemConversation {path} {pubkeys} {event} />
{/if}
