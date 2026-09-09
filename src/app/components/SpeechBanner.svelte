<script lang="ts">
  import Play from "@assets/icons/play.svg?dataurl"
  import Pause from "@assets/icons/pause.svg?dataurl"
  import Close from "@assets/icons/close.svg?dataurl"
  import VolumeLoud from "@assets/icons/volume-loud.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import Banner from "@app/components/Banner.svelte"
  import {speech, stopSpeech} from "@app/speech"

  let audio: HTMLAudioElement
  let playing = $state(false)
  let currentTime = $state(0)
  let duration = $state(0)

  // Duration is NaN until the browser has read the metadata, so the scrubber stays at zero
  // length rather than rendering a range with no end.
  const scrubbable = $derived(Number.isFinite(duration) ? duration : 0)

  const toggle = () => (playing ? audio.pause() : audio.play())

  const scrub = (event: Event & {currentTarget: HTMLInputElement}) => {
    audio.currentTime = Number(event.currentTarget.value)
    currentTime = audio.currentTime
  }

  const display = (seconds: number) => {
    const whole = Math.floor(seconds)

    return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`
  }
</script>

{#if $speech}
  <Banner>
    {#if $speech.src}
      <audio
        bind:this={audio}
        src={$speech.src}
        autoplay
        onplay={() => (playing = true)}
        onpause={() => (playing = false)}
        onended={() => (playing = false)}
        ondurationchange={() => (duration = audio.duration)}
        ontimeupdate={() => (currentTime = audio.currentTime)}></audio>
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
        <span class="font-semibold">{$speech.src ? "Reading" : "Preparing"}</span>
        <span class="truncate text-content-muted">a message from {$speech.title}</span>
      </span>
      {#if $speech.src}
        <span class="flex items-center gap-2 text-xs text-content-muted">
          <input
            aria-label="Seek within the message"
            class="range min-w-0 flex-1"
            type="range"
            min="0"
            max={scrubbable}
            step="0.1"
            value={currentTime}
            oninput={scrub} />
          <span class="whitespace-nowrap">{display(currentTime)} / {display(scrubbable)}</span>
        </span>
      {/if}
    </div>
    <Button
      aria-label="Stop reading"
      class="button button-circle button-sm button-neutral shrink-0"
      onclick={stopSpeech}>
      <Icon icon={Close} size={4} />
    </Button>
  </Banner>
{/if}
