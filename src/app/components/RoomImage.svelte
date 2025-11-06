<script lang="ts">
  import Hashtag from "@assets/icons/hashtag.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import ImageIcon from "@lib/components/ImageIcon.svelte"
  import {deriveRoom} from "@app/core/state"

  interface Props {
    h: any
    url: any
  }

  const {url, h}: Props = $props()

  const room = deriveRoom(url, h)
</script>

{#if $room.picture}
  <ImageIcon src={$room.picture} alt="Room icon" />
{:else}
  <Icon icon={Hashtag} />
{/if}
