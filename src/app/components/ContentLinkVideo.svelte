<script lang="ts">
  import {onDestroy, onMount} from "svelte"
  import {displayUrl} from "@welshman/lib"
  import type {TrustedEvent} from "@welshman/util"
  import LinkRound from "@assets/icons/link-round.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import {decryptUrl} from "@lib/media"

  type Props = {
    url: string
    event: TrustedEvent
    controls?: boolean
    autoplay?: boolean
    poster?: string
    class?: string
  }

  const {
    url,
    event,
    controls = false,
    autoplay = false,
    poster,
    class: className = "",
  }: Props = $props()

  const controller = new AbortController()

  let hasError = $state(false)
  let src = $state("")

  onMount(async () => {
    try {
      src = await decryptUrl(url, event, controller.signal)
    } catch (error) {
      if (!controller.signal.aborted) {
        console.error(error)
        hasError = true
      }
    }
  })

  onDestroy(() => {
    controller.abort()

    if (src.startsWith("blob:")) {
      URL.revokeObjectURL(src)
    }
  })
</script>

{#if hasError}
  <a href={url} class="link-content whitespace-normal wrap-anywhere">
    <Icon icon={LinkRound} size={3} class="inline-block" />
    {displayUrl(url)}
  </a>
{:else if src}
  <video {src} {controls} {autoplay} {poster} playsinline preload="metadata" class={className}
  ></video>
{/if}
