<script lang="ts">
  import type {TrustedEvent} from "@welshman/util"
  import ContentLinkBlockImage from "@app/components/ContentLinkBlockImage.svelte"
  import ContentLinkVideo from "@app/components/ContentLinkVideo.svelte"
  import Button from "@lib/components/Button.svelte"
  import {isVideoUrl} from "@lib/media"

  type Props = {
    url: string
    event: TrustedEvent
  }

  const {url, event}: Props = $props()

  const back = () => history.back()
</script>

{#if isVideoUrl(url, event)}
  <div class="flex h-screen w-screen items-center justify-center p-4">
    <ContentLinkVideo
      {url}
      {event}
      controls
      autoplay
      class="m-auto max-h-full max-w-full rounded-2xl" />
  </div>
{:else}
  <Button class="m-auto h-screen w-screen cursor-pointer p-4" onclick={back}>
    <ContentLinkBlockImage {url} {event} class="m-auto max-h-full max-w-full rounded-2xl" />
  </Button>
{/if}
