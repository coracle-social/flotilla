<script lang="ts">
  import {preventDefault} from "@lib/html"
  import AltArrowLeft from "@assets/icons/alt-arrow-left.svg?dataurl"
  import HomeSmile from "@assets/icons/home-smile.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import Modal from "@lib/components/Modal.svelte"
  import ModalBody from "@lib/components/ModalBody.svelte"
  import ModalHeader from "@lib/components/ModalHeader.svelte"
  import ModalTitle from "@lib/components/ModalTitle.svelte"
  import ModalFooter from "@lib/components/ModalFooter.svelte"
  import ProgressBar from "@app/components/ProgressBar.svelte"
  import {pushToast} from "@app/ui/toast"

  type Props = {
    next: () => void
    step?: number
    totalSteps?: number
  }

  const {next, step, totalSteps}: Props = $props()

  const back = () => history.back()

  const submit = async () => {
    loading = true

    try {
      await next()
    } catch (e) {
      console.error(e)
      pushToast({theme: "error", message: "Failed to complete sign up."})
    } finally {
      loading = false
    }
  }

  let loading = $state(false)
</script>

<Modal tag="form" onsubmit={preventDefault(submit)}>
  <ModalBody>
    <ModalHeader>
      <ModalTitle>You're all set!</ModalTitle>
    </ModalHeader>
    <p>Your profile is ready, and you can start chatting right away.</p>
    <p>
      Your dashboard is where you open invite links, discover community spaces, and keep up with the
      ones you have already joined.
    </p>
  </ModalBody>
  {#if step && totalSteps}
    <ProgressBar current={step} total={totalSteps} />
  {/if}
  <ModalFooter>
    <Button class="button button-link" onclick={back}>
      <Icon icon={AltArrowLeft} />
      Go back
    </Button>
    <Button class="button button-primary" type="submit" disabled={loading}>
      {#if loading}
        <Spinner {loading}>Go to Dashboard</Spinner>
      {:else}
        <Icon icon={HomeSmile} />
        Go to Dashboard
      {/if}
    </Button>
  </ModalFooter>
</Modal>
