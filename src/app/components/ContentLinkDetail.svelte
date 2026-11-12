<script lang="ts">
  import type {TrustedEvent} from "@welshman/util"
  import ContentLinkBlockImage from "@app/components/ContentLinkBlockImage.svelte"
  import ContentLinkVideo from "@app/components/ContentLinkVideo.svelte"
  import {isVideoUrl} from "@lib/media"

  type Props = {
    url: string
    event: TrustedEvent
  }

  const {url, event}: Props = $props()

  const back = () => history.back()
</script>

<div class="relative h-screen w-screen">
  <button
    type="button"
    aria-label="Close preview"
    class="absolute inset-0 cursor-pointer"
    onclick={back}>
  </button>
  <!-- A tap beside the media reaches the backdrop, while the video keeps its own for its controls. -->
  <div class="pointer-events-none absolute inset-0 flex items-center justify-center p-4">
    {#if isVideoUrl(url, event)}
      <ContentLinkVideo
        {url}
        {event}
        controls
        autoplay
        class="pointer-events-auto m-auto max-h-full max-w-full rounded-2xl" />
    {:else}
      <ContentLinkBlockImage {url} {event} class="m-auto max-h-full max-w-full rounded-2xl" />
    {/if}
  </div>
</div>
