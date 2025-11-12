<script lang="ts">
  import Hashtag from "@assets/icons/hashtag.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import ImageIcon from "@lib/components/ImageIcon.svelte"
  import {deriveRoom} from "@app/core/state"

  interface Props {
    h: string
    url: string
    size?: number
  }

  const {url, h, size = 5}: Props = $props()

  const room = deriveRoom(url, h)
</script>

{#if $room.picture}
  <ImageIcon src={$room.picture} {size} alt="Room icon" class="rounded-lg" />
{:else}
  <Icon icon={Hashtag} {size} />
{/if}
