<script lang="ts">
  import {onDestroy, onMount} from "svelte"
  import type {MaybeAsync} from "@welshman/lib"
  import TrashBin from "@assets/icons/trash-bin-minimalistic.svg?dataurl"
  import {formatDuration} from "@lib/util"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import Modal from "@lib/components/Modal.svelte"
  import ModalBody from "@lib/components/ModalBody.svelte"
  import ModalHeader from "@lib/components/ModalHeader.svelte"
  import ModalTitle from "@lib/components/ModalTitle.svelte"
  import ModalFooter from "@lib/components/ModalFooter.svelte"
  import MicLevelMeter from "@app/components/MicLevelMeter.svelte"
  import type {Dictation} from "@app/dictation"
  import {clearDictation, getDictation, startDictation} from "@app/dictation"
  import {popModal} from "@app/modal"
  import {pushToast} from "@app/toast"

  type Props = {
    key: string
    // True once the transcript reached the composer, false with the recording still in hand.
    onTranscribe: () => MaybeAsync<boolean>
    onVoiceNote: (audio: File) => MaybeAsync<void>
    onDiscard: () => void
  }

  const {key, onTranscribe, onVoiceNote, onDiscard}: Props = $props()

  // The recording is held in the registry rather than in state, so nothing here proxies a track.
  let dictation: Dictation | undefined = getDictation(key)
  let started = 0
  let timer: ReturnType<typeof setInterval> | undefined
  let pending = true

  let recording = $state(false)
  let busy = $state(true)
  let asking = $state(!dictation)
  let elapsed = $state(0)
  let track = $state<MediaStreamTrack | undefined>()
  let source = $state("")
  let working = $state<"transcribe" | "send" | undefined>()

  const blocked = $derived(busy || working !== undefined)

  const start = async () => {
    try {
      dictation = await startDictation(key)
      track = dictation.track
      started = Date.now()
      timer = setInterval(() => {
        elapsed = (Date.now() - started) / 1000
      }, 250)
      asking = false
      recording = true
      busy = false
    } catch (error) {
      console.error(error)
      asking = false
      pushToast({theme: "error", message: "Failed to access your microphone."})
      popModal()
    }
  }

  // A recording that has stopped is listenable, whether it was just made or handed back.
  const review = async (recorded: Dictation) => {
    if (!source) {
      source = URL.createObjectURL(await recorded.audio)
    }

    busy = false
  }

  const stop = () => {
    if (recording) {
      dictation?.stop()
      clearInterval(timer)
      recording = false
      track = undefined
    }
  }

  const transcribe = async () => {
    if (dictation) {
      stop()

      working = "transcribe"
      // The transcription owns the recording from here, and outlives this dialog closing.
      pending = false

      if (await onTranscribe()) {
        popModal()
      } else {
        pending = true
        working = undefined

        await review(dictation)
      }
    }
  }

  const send = async () => {
    if (dictation) {
      stop()

      working = "send"
      pending = false

      const file = await dictation.audio

      clearDictation(key)

      await onVoiceNote(file)

      popModal()
    }
  }

  onMount(() => {
    if (dictation) {
      review(dictation)
    } else {
      start()
    }
  })

  // Leaving without choosing throws the recording away.
  onDestroy(() => {
    clearInterval(timer)

    if (recording) {
      dictation?.stop()
    }

    if (source) {
      URL.revokeObjectURL(source)
    }

    if (pending) {
      onDiscard()
    }
  })
</script>

<Modal>
  <ModalBody>
    <ModalHeader>
      <ModalTitle>Record a message</ModalTitle>
    </ModalHeader>
    {#if recording}
      <div class="py-2">
        <MicLevelMeter {track} hint={formatDuration(elapsed)} />
      </div>
    {:else if source}
      <audio controls src={source} preload="metadata" class="w-full"></audio>
    {:else}
      <div class="flex flex-col items-center gap-3 py-6">
        <Spinner />
        {#if asking}
          <p class="text-sm opacity-60" role="status">Waiting for permission…</p>
        {/if}
      </div>
    {/if}
  </ModalBody>
  <ModalFooter>
    <Button
      class="button button-link button-circle tip tip-right h-10 w-10 min-w-10"
      data-tip="Discard"
      aria-label="Discard"
      disabled={working !== undefined}
      onclick={popModal}>
      <Icon icon={TrashBin} />
    </Button>
    <div class="flex gap-2">
      <Button class="button button-neutral" disabled={blocked} onclick={transcribe}>
        <Spinner loading={working === "transcribe"}>Transcribe</Spinner>
      </Button>
      <Button class="button button-primary" disabled={blocked} onclick={send}>
        <Spinner loading={working === "send"}>Send voice note</Spinner>
      </Button>
    </div>
  </ModalFooter>
</Modal>
