<script lang="ts">
  import {onDestroy, onMount} from "svelte"
  import type {MaybeAsync} from "@welshman/lib"
  import Microphone from "@assets/icons/microphone.svg?dataurl"
  import {localSttStatus} from "@lib/stt"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import {errorMessage} from "@lib/util"
  import VoiceRecorder from "@app/components/VoiceRecorder.svelte"
  import {setupVoice} from "@app/components/flows/voice"
  import type {Dictation} from "@app/tools/audio/stt"
  import {clearDictation, getDictation, transcribeDictation} from "@app/tools/audio/stt"
  import {pushModal} from "@app/navigation/dialogs"
  import {pushToast} from "@app/navigation/toast"

  type Props = {
    key: string
    dictating?: boolean
    onTranscript: (text: string) => MaybeAsync<void>
    onVoiceNote: (audio: File) => MaybeAsync<void>
  }

  let {key, dictating = $bindable(false), onTranscript, onVoiceNote}: Props = $props()

  const record = () => {
    inFlight = true

    pushModal(VoiceRecorder, {
      key,
      onTranscribe: transcribe,
      onVoiceNote: attach,
      onDiscard: discard,
    })
  }

  // Asks for a provider first when none is ready, with the prompt over the recorder rather than replacing it.
  const startTranscript = async (dictation: Dictation): Promise<boolean> => {
    try {
      const setup = await transcribeDictation(dictation)

      if (setup) {
        if (await setupVoice("stt", setup, {nested: true})) {
          return startTranscript(dictation)
        }

        return false
      }

      return true
    } catch (error) {
      console.error(error)
      pushToast({theme: "error", message: `Failed to prepare dictation: ${errorMessage(error)}`})

      return false
    }
  }

  // The recorder waits on this, so it settles once the transcript lands or comes back empty.
  const transcribe = async () => {
    const dictation = getDictation(key)

    if (dictation && (await startTranscript(dictation))) {
      return deliver(dictation)
    }

    return false
  }

  const deliver = async (dictation: Dictation) => {
    await dictation.finished

    // A composer that has gone away has nowhere to put the transcript, so leave the dictation there.
    if (destroyed || getDictation(key) !== dictation) {
      return false
    }

    if (dictation.error) {
      console.error(dictation.error)
      pushToast({theme: "error", message: `Failed to transcribe: ${errorMessage(dictation.error)}`})
    } else if (!dictation.transcript?.trim()) {
      pushToast({message: "No speech was detected. You can retry or send the recording."})
    } else {
      clearDictation(key)
      inFlight = false

      await onTranscript(dictation.transcript)

      return true
    }

    dictation.finished = undefined

    return false
  }

  // A transcription that outlived its recorder lands here instead, so this button shows the wait.
  const resume = async (dictation: Dictation) => {
    inFlight = true
    loading = true

    const delivered = await deliver(dictation)

    loading = false

    if (!delivered) {
      record()
    }
  }

  const attach = async (audio: File) => {
    await onVoiceNote(audio)

    inFlight = false
  }

  const discard = () => {
    clearDictation(key)

    inFlight = false
  }

  let destroyed = false
  // A recording or transcription in flight, which keeps the button the recorder reports back to.
  let inFlight = $state(false)
  let loading = $state(false)

  $effect(() => {
    dictating = inFlight
  })

  // Pick up a dictation an earlier composer left running.
  onMount(() => {
    const dictation = getDictation(key)

    if (dictation?.finished) {
      resume(dictation)
    } else if (dictation) {
      record()
    }
  })

  onDestroy(() => {
    destroyed = true
  })
</script>

<Button
  class="button button-ghost button-circle tip tip-left"
  data-tip={loading ? $localSttStatus.message || "Preparing dictation…" : "Record a message"}
  aria-label="Start dictation"
  disabled={loading}
  onclick={record}>
  {#if loading}
    <Spinner size="xs" />
  {:else}
    <Icon icon={Microphone} />
  {/if}
</Button>
