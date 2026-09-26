<script lang="ts">
  import cx from "classnames"
  import Microphone from "@assets/icons/microphone.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import {watchAudioLevel} from "@lib/audio"

  type Props = {
    track: MediaStreamTrack | undefined
    error?: string
    offMessage?: string
  }

  const {track, error, offMessage = "Microphone is off"}: Props = $props()

  const NOISE_FLOOR = 0.03

  let level = $state(0)

  $effect(() => {
    const t = track

    level = 0

    if (t && !error) {
      // Reading the `$state` this effect writes would make it depend on its own output.
      let smoothed = 0

      return watchAudioLevel(new MediaStream([t]), rms => {
        if (t.enabled && t.readyState === "live") {
          const gated = rms < NOISE_FLOOR ? 0 : (rms - NOISE_FLOOR) / (1 - NOISE_FLOOR)

          smoothed += (Math.min(1, gated * 4) - smoothed) * 0.5

          if (smoothed < 0.005) {
            smoothed = 0
          }
        } else {
          smoothed = 0
        }

        level = smoothed
      })
    }
  })
</script>

<div class="flex items-center gap-2">
  <Icon icon={Microphone} size={4} class="shrink-0 opacity-70" />
  {#if error}
    <p class="text-xs text-error" role="alert">{error}</p>
  {:else if !track}
    <p class="text-xs opacity-60">{offMessage}</p>
  {:else}
    <div
      class="flex flex-1 items-center gap-1"
      role="meter"
      aria-label="Microphone input level"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(level * 100)}>
      {#each Array(5) as _, i (i)}
        <div
          class={cx(
            "h-2 flex-1 rounded-full transition-colors",
            level * 5 > i ? "bg-success" : "bg-surface-more",
          )}>
        </div>
      {/each}
    </div>
    <span class="shrink-0 text-xs opacity-60">Speak to test</span>
  {/if}
</div>
