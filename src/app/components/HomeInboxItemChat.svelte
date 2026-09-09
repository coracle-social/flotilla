<script lang="ts">
  import {remove, uniq} from "@welshman/lib"
  import type {TrustedEvent} from "@welshman/util"
  import HomeInboxItemCard from "@app/components/HomeInboxItemCard.svelte"
  import ProfileCircle from "@app/components/ProfileCircle.svelte"
  import ProfileName from "@app/components/ProfileName.svelte"
  import {user} from "@app/core"

  type Props = {
    path: string
    pubkeys: string[]
    event: TrustedEvent
  }

  const {path, pubkeys, event}: Props = $props()

  const others = $derived(uniq(remove($user.pubkey, pubkeys)))
</script>

<HomeInboxItemCard {path} {event}>
  {#snippet icon()}
    <ProfileCircle pubkey={others[0] || $user.pubkey} size={9} class="shrink-0" />
  {/snippet}
  {#snippet title()}
    {#if others.length > 0}
      <ProfileName pubkey={others[0]} />
      {#if others.length > 1}
        and {others.length - 1} {others.length > 2 ? "others" : "other"}
      {/if}
    {:else}
      Note to self
    {/if}
  {/snippet}
  {#snippet subtitle()}
    direct message
  {/snippet}
</HomeInboxItemCard>
