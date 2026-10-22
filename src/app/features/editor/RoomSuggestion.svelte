<script lang="ts">
  import {displayRelayUrl} from "@welshman/util"
  import {splitRoomKey} from "@welshman/app"
  import RoomNameWithImage from "@app/components/RoomNameWithImage.svelte"
  import {HIDE_NOSTR} from "@app/core/env"

  type Props = {
    value: string
  }

  const {value}: Props = $props()
  const [url, h] = splitRoomKey(value)
</script>

<div class="max-w-full overflow-hidden text-ellipsis flex flex-col">
  <RoomNameWithImage {url} {h} />
  {#if !HIDE_NOSTR}
    <span class="text-primary text-sm">{displayRelayUrl(url)}<span> </span></span>
  {/if}
</div>
