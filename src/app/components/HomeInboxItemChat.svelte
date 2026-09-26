<script lang="ts">
  import {remove, uniq} from "@welshman/lib"
  import type {TrustedEvent} from "@welshman/util"
  import HomeInboxItemCard from "@app/components/HomeInboxItemCard.svelte"
  import ChatTitle from "@app/components/ChatTitle.svelte"
  import ProfileCircle from "@app/components/ProfileCircle.svelte"
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
    <ChatTitle {pubkeys} />
  {/snippet}
  {#snippet subtitle()}
    direct message
  {/snippet}
</HomeInboxItemCard>
