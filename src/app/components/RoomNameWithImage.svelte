<script lang="ts">
  import Lock from "@assets/icons/lock-keyhole.svg?dataurl"
  import Hashtag from "@assets/icons/hashtag.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import RoomName from "@app/components/RoomName.svelte"
  import {deriveRoom} from "@app/core/state"

  interface Props {
    url: any
    h: any
  }

  const {url, h}: Props = $props()

  const room = deriveRoom(url, h)
</script>

{#if $room?.picture}
  {@const src = $room.picture}
  {#if src.match("\.(png|svg)$") || src.match("image/(png|svg)")}
    <Icon icon={src} />
  {:else}
    <img alt="Room icon" {src} class="h-6 w-6 rounded-lg" />
  {/if}
{:else if $room?.closed || $room?.private}
  <Icon icon={Lock} />
{:else}
  <Icon icon={Hashtag} />
{/if}
<div class="min-w-0 overflow-hidden text-ellipsis">
  <RoomName {url} {h} />
</div>
