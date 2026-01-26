<script lang="ts">
  import {getProfile, loadProfile} from "@welshman/app"
  import {isMobile} from '@lib/html'
  import ProfileCircle from "@app/components/ProfileCircle.svelte"

  type Props = {
    pubkeys: string[]
    size?: number
  }

  const {pubkeys, size = 7}: Props = $props()
  const limit = isMobile ? 7 : 15

  for (const pubkey of pubkeys) {
    loadProfile(pubkey)
  }

  const visiblePubkeys = $derived.by(() => {
    const filtered = pubkeys.filter(pubkey => getProfile(pubkey)?.picture)

    return filtered.length > 0 ? filtered : pubkeys.slice(0, 1)
  })
</script>

<div class="flex pr-3">
  {#each visiblePubkeys.toSorted().slice(0, limit) as pubkey (pubkey)}
    <div
      class="z-feature -mr-3 inline-block flex h-8 w-8 items-center justify-center rounded-full bg-base-100">
      <ProfileCircle class="h-8 w-8 bg-base-300" {pubkey} {size} />
    </div>
  {/each}
</div>
