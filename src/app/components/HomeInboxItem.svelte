<script lang="ts">
  import HomeInboxItemRow from "@app/components/HomeInboxItemRow.svelte"
  import HomeInboxItemChat from "@app/components/HomeInboxItemChat.svelte"
  import RelayIcon from "@app/components/RelayIcon.svelte"
  import RelayName from "@app/components/RelayName.svelte"
  import RoomName from "@app/components/RoomName.svelte"
  import type {Activity} from "@app/notifications"

  type Props = {
    conversation: Activity
  }

  const {conversation}: Props = $props()

  const {path, url, h, pubkeys = [], event} = $derived(conversation)
</script>

{#if url}
  <HomeInboxItemRow {path} {url} {event}>
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
  </HomeInboxItemRow>
{:else}
  <HomeInboxItemChat {path} {pubkeys} {event} />
{/if}
