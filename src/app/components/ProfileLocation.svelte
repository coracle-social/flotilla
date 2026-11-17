<script lang="ts">
  import MapPoint from "@assets/icons/map-point.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import {getProfileLocation} from "@lib/location"
  import {profiles} from "@app/core/plugins"

  type Props = {
    pubkey: string
  }

  const {pubkey}: Props = $props()

  const profile = $profiles.one(pubkey)
  const location = $derived(getProfileLocation($profile))
</script>

{#if location}
  <p class="flex w-fit items-center gap-2 text-sm opacity-75">
    <Icon icon={MapPoint} size={4} />
    {location}
  </p>
{/if}
