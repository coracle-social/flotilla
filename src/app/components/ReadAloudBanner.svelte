<script lang="ts">
  import Play from "@assets/icons/play.svg?dataurl"
  import Pause from "@assets/icons/pause.svg?dataurl"
  import Close from "@assets/icons/close.svg?dataurl"
  import VolumeLoud from "@assets/icons/volume-loud.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import Banner from "@app/components/Banner.svelte"
  import {reading, stopReadingAloud} from "@app/tools/audio/tts"

  let audio: HTMLAudioElement | undefined = $state()
  let playing = $state(false)
  let currentTime = $state(0)
  let duration = $state(0)

  const src = $derived($reading?.audio ? URL.createObjectURL($reading.audio) : undefined)

  // Duration is NaN until the browser has read the metadata.
  const scrubbable = $derived(Number.isFinite(duration) ? duration : 0)

  const toggle = () => (playing ? audio?.pause() : audio?.play())

  const onPlay = () => {
    playing = true
  }

  const onStop = () => {
    playing = false
  }

  const display = (seconds: number) => {
    const whole = Math.floor(seconds)

    return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`
  }

  $effect(() => {
    const url = src

    return () => {
      if (url) {
        URL.revokeObjectURL(url)
      }
    }
  })
</script>

{#if $reading}
  <Banner>
    {#if src}
      <audio
        bind:this={audio}
        bind:currentTime
        bind:duration
        {src}
        autoplay
        onplay={onPlay}
        onpause={onStop}
        onended={onStop}></audio>
      <Button
        aria-label={playing ? "Pause message" : "Play message"}
        class="button button-circle button-sm button-primary shrink-0"
        onclick={toggle}>
        <Icon icon={playing ? Pause : Play} size={4} />
      </Button>
    {:else}
      <Spinner size="xs" />
    {/if}
    <div class="flex min-w-0 flex-1 flex-col gap-1">
      <span class="flex min-w-0 items-center gap-2 truncate text-sm">
        <Icon icon={VolumeLoud} size={4} />
        <span class="font-semibold">{src ? "Reading" : "Preparing"}</span>
        <span class="truncate text-content-muted">a message from {$reading.title}</span>
      </span>
      {#if src}
        <span class="flex items-center gap-2 text-xs text-content-muted">
          <input
            aria-label="Seek within the message"
            class="range min-w-0 flex-1"
            type="range"
            min="0"
            max={scrubbable}
            step="0.1"
            bind:value={currentTime} />
          <span class="whitespace-nowrap">{display(currentTime)} / {display(scrubbable)}</span>
        </span>
      {/if}
    </div>
    <Button
      aria-label="Stop reading"
      class="button button-circle button-sm button-neutral shrink-0"
      onclick={stopReadingAloud}>
      <Icon icon={Close} size={4} />
    </Button>
  </Banner>
{/if}
