<script lang="ts">
  import {remove, uniq} from "@welshman/lib"
  import HomeActivityItemRow from "@app/components/HomeActivityItemRow.svelte"
  import ConversationTitle from "@app/components/ConversationTitle.svelte"
  import ProfileCircle from "@app/components/ProfileCircle.svelte"
  import RelayIcon from "@app/components/RelayIcon.svelte"
  import RelayName from "@app/components/RelayName.svelte"
  import RoomName from "@app/components/RoomName.svelte"
  import {user} from "@app/core/user"
  import type {ActivityItem} from "@app/areas/home/activity/model"

  type Props = {
    item: Extract<ActivityItem, {type: "chat"}>
  }

  const {item}: Props = $props()

  const {path, url, h, pubkeys = [], event} = $derived(item.activity)

  const others = $derived(uniq(remove($user.pubkey, pubkeys)))
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
  <HomeActivityItemRow {path} {event}>
    {#snippet icon()}
      <ProfileCircle pubkey={others[0] || $user.pubkey} size={9} class="shrink-0" />
    {/snippet}
    {#snippet title()}
      <ConversationTitle {pubkeys} />
    {/snippet}
    {#snippet subtitle()}
      direct message
    {/snippet}
  </HomeActivityItemRow>
{/if}
