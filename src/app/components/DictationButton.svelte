<script lang="ts">
  import {onDestroy, onMount} from "svelte"
  import cx from "classnames"
  import type {MaybeAsync} from "@welshman/lib"
  import Microphone from "@assets/icons/microphone.svg?dataurl"
  import Stop from "@assets/icons/record.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import {errorMessage} from "@lib/util"
  import DictationAction from "@app/components/DictationAction.svelte"
  import {clearDictation, getDictation, startDictation, transcribeDictation} from "@app/dictation"
  import {pushModal} from "@app/modal"
  import {pushToast} from "@app/toast"

  type Props = {
    key: string
    dictating?: boolean
    onTranscript: (text: string) => MaybeAsync<void>
    onVoiceNote: (audio: File) => MaybeAsync<void>
  }

  let {key, dictating = $bindable(false), onTranscript, onVoiceNote}: Props = $props()

  // Room noise idles just below this, so the pulse follows quiet speech too.
  const onLevel = (level: number) => {
    loud = level > 0.03
  }

  const start = async () => {
    // A permission prompt can sit for a while, and a second click would open a stream nobody holds.
    loading = true

    try {
      await startDictation(key, onLevel)
      recording = true
    } catch (error) {
      console.error(error)
      pushToast({theme: "error", message: "Failed to access your microphone."})
    } finally {
      loading = false
    }
  }

  const stop = () => {
    getDictation(key)?.stop()

    recording = false
    loud = false
    // Hold the button until the recording has been spent.
    loading = true

    choose()
  }

  const choose = () =>
    pushModal(DictationAction, {
      onTranscribe: transcribe,
      onVoiceNote: attach,
      onDiscard: discard,
    })

  const transcribe = () => {
    const dictation = getDictation(key)

    if (dictation) {
      transcribeDictation(dictation)
      deliver()
    }
  }

  const attach = async () => {
    const dictation = getDictation(key)

    if (dictation) {
      const audio = await dictation.audio

      clearDictation(key)
      loading = false

      await onVoiceNote(audio)
    }
  }

  const discard = () => {
    clearDictation(key)

    loading = false
  }

  const deliver = async () => {
    const dictation = getDictation(key)

    if (dictation?.finished) {
      loading = true

      await dictation.finished

      // A composer that has gone away has nowhere to put the transcript, so leave the dictation where it is.
      if (!destroyed) {
        if (dictation.error) {
          console.error(dictation.error)
          pushToast({
            theme: "error",
            message: `Failed to transcribe: ${errorMessage(dictation.error)}`,
          })
        } else {
          await onTranscript(dictation.transcript ?? "")
        }

        clearDictation(key)
      }

      loading = false
    }
  }

  const toggle = () => (recording ? stop() : start())

  let destroyed = false
  let recording = $state(false)
  // In flight from the start when a dictation is already waiting to be picked up.
  let loading = $state(Boolean(getDictation(key)))
  let loud = $state(false)

  const buttonClass = $derived(
    cx(
      "button button-circle tip tip-left h-10 w-10 min-w-10",
      recording ? "button-error" : "button-primary",
      {"pulse-scale": loud},
    ),
  )

  $effect(() => {
    dictating = recording || loading
  })

  // Pick up a dictation an earlier composer left running.
  onMount(() => {
    const dictation = getDictation(key)

    if (dictation?.finished) {
      deliver()
    } else if (dictation) {
      choose()
    }
  })

  onDestroy(() => {
    destroyed = true

    const dictation = getDictation(key)

    if (dictation?.recording) {
      dictation.stop()
    }
  })
</script>

<Button
  class={buttonClass}
  data-tip={recording ? "Stop recording" : "Record a message"}
  aria-label={recording ? "Stop recording" : "Start dictation"}
  disabled={loading}
  onclick={toggle}>
  {#if loading}
    <Spinner size="xs" />
  {:else if recording}
    <Icon icon={Stop} />
  {:else}
    <Icon icon={Microphone} />
  {/if}
</Button>
