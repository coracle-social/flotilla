<script lang="ts">
  import {getProfile} from "@welshman/app"
  import ProfileCircle from "@app/components/ProfileCircle.svelte"

  type Props = {
    pubkeys: string[]
    size?: number
  }

  const {pubkeys, size = 7}: Props = $props()
</script>

<div class="flex pr-3">
  {#each pubkeys
    .filter(p => getProfile(p)?.picture)
    .toSorted()
    .slice(0, 15) as pubkey (pubkey)}
    <div class="z-feature -mr-3 inline-block">
      <ProfileCircle class="h-8 w-8 bg-base-300" {pubkey} {size} />
    </div>
  {/each}
</div>
