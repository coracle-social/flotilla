<script lang="ts">
  import cx from "classnames"
  import Microphone from "@assets/icons/microphone.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"

  type Props = {
    track: MediaStreamTrack | undefined
    error?: string
    offMessage?: string
  }

  const {track, error, offMessage = "Microphone is off"}: Props = $props()

  let level = $state(0)

  $effect(() => {
    const t = track
    level = 0

    if (!t || error) {
      return
    }

    let frame: number | undefined
    const context = new AudioContext()
    const analyser = context.createAnalyser()
    analyser.fftSize = 512
    context.createMediaStreamSource(new MediaStream([t])).connect(analyser)
    const data = new Uint8Array(analyser.frequencyBinCount)

    // Reading the `$state` this effect writes would make it depend on its own output.
    let smoothed = 0

    const tick = () => {
      if (!t.enabled || t.readyState !== "live") {
        smoothed = 0
        level = 0
        frame = requestAnimationFrame(tick)
        return
      }

      analyser.getByteTimeDomainData(data)
      let sumSquares = 0
      for (const v of data) {
        const normalized = (v - 128) / 128
        sumSquares += normalized * normalized
      }
      const rms = Math.sqrt(sumSquares / data.length)
      const NOISE_FLOOR = 0.03
      const gated = rms < NOISE_FLOOR ? 0 : (rms - NOISE_FLOOR) / (1 - NOISE_FLOOR)
      smoothed += (Math.min(1, gated * 4) - smoothed) * 0.5
      if (smoothed < 0.005) {
        smoothed = 0
      }
      level = smoothed
      frame = requestAnimationFrame(tick)
    }
    tick()

    return () => {
      if (frame !== undefined) {
        cancelAnimationFrame(frame)
      }
      context.close().catch(() => {})
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
