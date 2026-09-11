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
  import OpenRouterEnable from "@app/components/OpenRouterEnable.svelte"
  import {clearDictation, getDictation, startDictation} from "@app/dictation"
  import {getSetting} from "@app/settings"
  import {pushModal} from "@app/modal"
  import {pushToast} from "@app/toast"

  type Props = {
    key: string
    dictating?: boolean
    onTranscript: (text: string) => MaybeAsync<void>
  }

  let {key, dictating = $bindable(false), onTranscript}: Props = $props()

  // Room noise idles just below this, so the pulse follows quiet speech too.
  const onLevel = (level: number) => {
    loud = level > 0.03
  }

  const start = async () => {
    if (getSetting("openrouter_key")) {
      // Granting microphone access can sit on a permission prompt for a while, so hold the button
      // until it resolves — a second click would open a stream nothing is left holding on to.
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
    } else {
      pushModal(OpenRouterEnable, {
        feature: "Voice input",
        subtitle: "Dictate your messages instead of typing them.",
      })
    }
  }

  const stop = () => {
    getDictation(key)?.stop()

    recording = false
    loud = false

    deliver()
  }

  const deliver = async () => {
    const dictation = getDictation(key)

    if (dictation) {
      loading = true

      await dictation.finished

      // A composer that has gone away has nowhere to put the transcript, so leave the dictation
      // where it is for whichever one mounts next.
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
  // Starts out in flight when a dictation is already waiting to be picked up, so that the composer
  // keeps rendering this button until its transcript has been handed over.
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
  onMount(deliver)

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
  data-tip={recording ? "Stop and transcribe" : "Record a message"}
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
