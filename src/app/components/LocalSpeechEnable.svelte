<script lang="ts">
  import {onDestroy} from "svelte"
  import {localSpeechStatus, runLocalSpeech} from "@lib/speech"
  import {speechModelBytes} from "@lib/speech/models"
  import {errorMessage} from "@lib/util"
  import Button from "@lib/components/Button.svelte"
  import Modal from "@lib/components/Modal.svelte"
  import ModalBody from "@lib/components/ModalBody.svelte"
  import ModalHeader from "@lib/components/ModalHeader.svelte"
  import ModalTitle from "@lib/components/ModalTitle.svelte"
  import ModalFooter from "@lib/components/ModalFooter.svelte"
  import {popModal} from "@app/ui/modal"
  import {pushToast} from "@app/ui/toast"

  type Props = {onReady?: () => void; onCancel?: () => void}
  const {onReady, onCancel}: Props = $props()
  const controller = new AbortController()

  const megabytes = Math.round(speechModelBytes / 1024 / 1024)

  const download = async () => {
    loading = true
    try {
      await runLocalSpeech({}, controller.signal)
      if (!controller.signal.aborted) {
        pending = false
        popModal()
        onReady?.()
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        console.error(error)
        pushToast({theme: "error", message: `Failed to load the model: ${errorMessage(error)}`})
      }
    } finally {
      loading = false
    }
  }

  let pending = true
  let loading = $state(false)
  const status = $derived($localSpeechStatus)

  // Leaving without the model hands the decision back to whoever asked for it.
  onDestroy(() => {
    controller.abort()

    if (pending) {
      onCancel?.()
    }
  })
</script>

<Modal>
  <ModalBody>
    <ModalHeader>
      <ModalTitle>Download a speech model?</ModalTitle>
    </ModalHeader>
    <p>
      Dictation can run on this device using multilingual Whisper Tiny (about {megabytes} MB). Accuracy
      varies by language and recording quality.
    </p>
    <p>
      The model downloads once and is cached on this device, and your recordings never leave it.
      Downloads can be large; use Wi-Fi if needed.
    </p>
    <p>You can remove it again in Content Settings.</p>
    {#if loading}
      <div class="flex flex-col gap-2">
        <progress class="progress" value={status.percent ?? 0} max="100"></progress>
        <p role="status" class="text-center text-sm text-content-muted">
          {status.message || "Waiting for another recording…"}
        </p>
      </div>
    {/if}
  </ModalBody>
  <ModalFooter>
    <Button class="button button-link" onclick={popModal}>Cancel</Button>
    {#if !loading}
      <Button class="button button-primary" onclick={download}>Download model</Button>
    {/if}
  </ModalFooter>
</Modal>
