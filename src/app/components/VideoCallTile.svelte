<script lang="ts">
  import type {Track} from "livekit-client"
  import cx from "classnames"

  type Props = {
    track: Track
    muted?: boolean
    fit?: "cover" | "contain"
    class?: string
  }

  const {track, muted = true, fit = "cover", class: className = ""}: Props = $props()

  let videoElement = $state<HTMLVideoElement | undefined>()

  $effect(() => {
    const element = videoElement
    const activeTrack = track
    if (!element) {
      return
    }
    activeTrack.attach(element)
    return () => {
      activeTrack.detach(element)
    }
  })
</script>

<video
  bind:this={videoElement}
  class={cx("h-full w-full", fit === "contain" ? "object-contain" : "object-cover", className)}
  playsinline
  {muted}></video>
