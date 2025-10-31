<script lang="ts">
  import Hashtag from "@assets/icons/hashtag.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import ImageIcon from "@lib/components/ImageIcon.svelte"
  import RoomName from "@app/components/RoomName.svelte"
  import {deriveRoom} from "@app/core/state"

  interface Props {
    url: any
    h: any
  }

  const {url, h}: Props = $props()

  const room = deriveRoom(url, h)
</script>

{#if $room.picture}
  {@const src = $room.picture}
  <ImageIcon {src} alt="Room icon" />
{:else}
  <Icon icon={Hashtag} />
{/if}
<div class="min-w-0 overflow-hidden text-ellipsis">
  <RoomName {url} {h} />
</div>
