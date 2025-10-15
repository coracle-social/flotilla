<script lang="ts">
  import type {TrustedEvent} from "@welshman/util"
  import {getPubkeyTagValues} from "@welshman/util"
  import ProfileLink from "@app/components/ProfileLink.svelte"

  type Props = {
    url: string
    event: TrustedEvent
  }

  const {url, event}: Props = $props()
</script>

{#each getPubkeyTagValues(event.tags) as pubkey}
  <div class="py-1 text-center text-xs opacity-75">
    <ProfileLink unstyled class="text-primary" {url} {pubkey} /> joined the room
  </div>
{/each}
