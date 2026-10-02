<script lang="ts">
  import {onDestroy, onMount} from "svelte"
  import type {MaybeAsync} from "@welshman/lib"
  import Microphone from "@assets/icons/microphone.svg?dataurl"
  import {localSpeechStatus} from "@lib/speech"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import {errorMessage} from "@lib/util"
  import VoiceRecorder from "@app/components/VoiceRecorder.svelte"
  import type {Dictation} from "@app/dictation"
  import {clearDictation, getDictation, transcribeDictation} from "@app/dictation"
  import type {InferenceProviderFor} from "@app/inference"
  import {resolveInference} from "@app/inference"
  import {pushModal} from "@app/modal"
  import {pushToast} from "@app/toast"

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

  // The recorder waits on this, so it settles once the transcript lands or comes back empty.
  const transcribe = async () => {
    const dictation = getDictation(key)

    if (dictation) {
      try {
        const {provider, ready} = await resolveInference("transcribe")

        if (ready) {
          transcribeDictation(dictation, provider.transcribe)

          return await deliver(dictation)
        }

        return await enable(provider)
      } catch (error) {
        console.error(error)
        pushToast({theme: "error", message: `Failed to prepare dictation: ${errorMessage(error)}`})
      }
    }

    return false
  }

  // The setup prompt sits over the recorder rather than replacing it, so the wait is one wait.
  const enable = (provider: InferenceProviderFor<"transcribe">) =>
    new Promise<boolean>(resolve => {
      provider.enable("transcribe", {
        nested: true,
        onReady: () => resolve(transcribe()),
        onCancel: () => resolve(false),
      })
    })

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
  class="button button-primary button-circle tip tip-left h-10 w-10 min-w-10"
  data-tip={loading ? $localSpeechStatus.message || "Preparing dictation…" : "Record a message"}
  aria-label="Start dictation"
  disabled={loading}
  onclick={record}>
  {#if loading}
    <Spinner size="xs" />
  {:else}
    <Icon icon={Microphone} />
  {/if}
</Button>
