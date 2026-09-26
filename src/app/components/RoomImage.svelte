<script lang="ts">
  import Hashtag from "@assets/icons/hashtag.svg?dataurl"
  import Volume from "@assets/icons/volume.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import ImageIcon from "@lib/components/ImageIcon.svelte"
  import {rooms} from "@app/core"

  type Props = {
    h: string
    url: string
    size?: number
    fallbackIcon?: string
  }

  const {url, h, size = 5, fallbackIcon = Hashtag}: Props = $props()

  const room = $rooms.forRoom(url, h)
  const picture = $derived($room?.meta?.picture())
  const isVoiceRoom = $derived($room?.meta?.hasLivekit())
</script>

{#if isVoiceRoom}
  <div class="flex shrink-0 items-center gap-1.5">
    <Icon size={size + 1} icon={Volume} />
    {#if picture}
      <span class="text-base">/</span>
      <ImageIcon src={picture} {size} alt="" class="rounded-xl" />
    {/if}
  </div>
{:else if picture}
  <ImageIcon src={picture} {size} alt="" class="rounded-xl" />
{:else}
  <Icon icon={fallbackIcon} {size} />
{/if}
