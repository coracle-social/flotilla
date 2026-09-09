<script lang="ts">
  import {onDestroy} from "svelte"
  import cx from "classnames"
  import type {Maybe, MaybeAsync} from "@welshman/lib"
  import Microphone from "@assets/icons/microphone.svg?dataurl"
  import Stop from "@assets/icons/record.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import {errorMessage} from "@lib/util"
  import OpenRouterEnable from "@app/components/OpenRouterEnable.svelte"
  import {startDictation, transcribe} from "@app/dictation"
  import {getSetting} from "@app/settings"
  import {pushModal} from "@app/modal"
  import {pushToast} from "@app/toast"

  type Props = {
    recording?: boolean
    onTranscript: (text: string) => MaybeAsync<void>
  }

  let {recording = $bindable(false), onTranscript}: Props = $props()

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
        finish = await startDictation(onLevel)
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

  const stop = async () => {
    if (finish) {
      const audio = finish()

      finish = undefined
      recording = false
      loading = true
      loud = false

      try {
        const text = await transcribe(await audio)

        await onTranscript(text)
      } catch (error) {
        console.error(error)
        pushToast({theme: "error", message: `Failed to transcribe: ${errorMessage(error)}`})
      } finally {
        loading = false
      }
    }
  }

  const toggle = () => (recording ? stop() : start())

  // Held outside of state because only the recording flag drives the markup, and clearing this
  // before the recorder has finished flushing is what keeps a second stop from re-entering.
  let finish: Maybe<() => Promise<Blob>>
  let loading = $state(false)
  let loud = $state(false)

  const buttonClass = $derived(
    cx(
      "button button-circle tip tip-left h-10 w-10 min-w-10",
      recording ? "button-error" : "button-primary",
      {"pulse-scale": loud},
    ),
  )

  onDestroy(() => {
    finish?.()
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
