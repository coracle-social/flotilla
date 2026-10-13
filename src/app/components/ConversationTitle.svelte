<script lang="ts">
  import {remove, uniq} from "@welshman/lib"
  import ProfileName from "@app/components/ProfileName.svelte"
  import {user} from "@app/core/app"

  type Props = {
    pubkeys: string[]
  }

  const {pubkeys}: Props = $props()

  const others = $derived(uniq(remove($user.pubkey, pubkeys)))
</script>

{#if others.length > 0}
  <ProfileName pubkey={others[0]} />
  {#if others.length === 2}
    and <ProfileName pubkey={others[1]} />
  {:else if others.length > 2}
    and {others.length - 1} others
  {/if}
{:else}
  Note to self
{/if}
