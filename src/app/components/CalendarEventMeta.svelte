<script lang="ts">
  import type {TrustedEvent} from "@welshman/util"
  import {TimeEvent} from "@welshman/domain"
  import UserCircle from "@assets/icons/user-circle.svg?dataurl"
  import MapPoint from "@assets/icons/map-point.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import {reader} from "@app/core/domain"
  import ProfileLink from "@app/components/ProfileLink.svelte"

  type Props = {
    event: TrustedEvent
    url: string
  }

  const {event, url}: Props = $props()

  const timeEvent = $derived(reader(TimeEvent)(event))

  const location = $derived(timeEvent.location())
</script>

<div class="flex min-w-0 flex-col gap-1 text-sm opacity-75">
  <span class="flex items-center gap-1">
    <Icon icon={UserCircle} size={4} />
    Posted by <ProfileLink pubkey={event.pubkey} {url} />
  </span>
  {#if location}
    <span class="flex items-start gap-1">
      <Icon icon={MapPoint} class="mt-[2px]" size={4} />
      <span class="wrap-break-word">{location}</span>
    </span>
  {/if}
</div>
