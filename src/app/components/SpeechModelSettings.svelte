<script lang="ts">
  import {onMount} from "svelte"
  import {hasLocalSpeech, removeLocalSpeech} from "@lib/speech"
  import {errorMessage} from "@lib/util"
  import Field from "@lib/components/Field.svelte"
  import Button from "@lib/components/Button.svelte"
  import LocalSpeechEnable from "@app/components/LocalSpeechEnable.svelte"
  import {pushModal} from "@app/ui/modal"
  import {pushToast} from "@app/ui/toast"

  const refresh = async () => {
    try {
      ready = await hasLocalSpeech()
    } catch (error) {
      console.error(error)
      pushToast({theme: "error", message: "Speech model storage is unavailable on this device."})
    }
  }
  const download = () => pushModal(LocalSpeechEnable, {onReady: refresh})
  const remove = async () => {
    loading = true
    try {
      await removeLocalSpeech()
      ready = false
    } catch (error) {
      console.error(error)
      pushToast({theme: "error", message: `Failed to remove the model: ${errorMessage(error)}`})
    } finally {
      loading = false
    }
  }

  let ready = $state(false)
  let loading = $state(false)
  onMount(refresh)
</script>

<Field>
  {#snippet label()}
    <p>Dictation</p>
  {/snippet}
  {#snippet input()}
    <div class="flex">
      {#if ready}
        <Button class="button button-neutral" onclick={remove} disabled={loading}>
          Remove model
        </Button>
      {:else}
        <Button class="button button-primary" onclick={download} disabled={loading}>
          Download model
        </Button>
      {/if}
    </div>
  {/snippet}
  {#snippet info()}
    <p>
      {#if ready}
        Recordings are transcribed on this device instead of being sent to OpenRouter.
      {:else}
        Download a model to transcribe recordings on this device instead of sending them to
        OpenRouter.
      {/if}
    </p>
  {/snippet}
</Field>
