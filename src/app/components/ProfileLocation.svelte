<script lang="ts">
  import {removeUndefined} from "@welshman/lib"
  import MapPoint from "@assets/icons/map-point.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import {profiles} from "@app/core/plugins"
  import {getProfileLocation} from "@app/features/location"

  type Props = {
    pubkey: string
    url?: string
  }

  const {pubkey, url}: Props = $props()

  const profile = $profiles.one(pubkey, removeUndefined([url]))
  const location = $derived(getProfileLocation($profile))
</script>

{#if location}
  <p class="flex w-fit items-center gap-2 text-sm opacity-75">
    <Icon icon={MapPoint} size={4} />
    {location}
  </p>
{/if}
