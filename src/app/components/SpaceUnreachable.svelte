<script lang="ts">
  import {preventDefault} from "@lib/html"
  import AltArrowLeft from "@assets/icons/alt-arrow-left.svg?dataurl"
  import Refresh from "@assets/icons/refresh.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import Modal from "@lib/components/Modal.svelte"
  import ModalBody from "@lib/components/ModalBody.svelte"
  import ModalHeader from "@lib/components/ModalHeader.svelte"
  import ModalTitle from "@lib/components/ModalTitle.svelte"
  import ModalSubtitle from "@lib/components/ModalSubtitle.svelte"
  import ModalFooter from "@lib/components/ModalFooter.svelte"
  import RelayLabel from "@app/components/RelayLabel.svelte"
  import {promptedSteps, retrySpace} from "@app/tools/spaces"
  import {popModal} from "@app/navigation/dialogs"
  import {navigate} from "@app/navigation/navigate"
  import {trackSubmit} from "@app/components/flows/submit"

  type Props = {
    url: string
    reason: "down" | "silent"
  }

  const {url, reason}: Props = $props()

  const back = () => navigate("/home")

  // Forgetting the prompt lets it come back if the space still can't be reached.
  const {loading, submit: retry} = trackSubmit(
    () => "Failed to reconnect to the space.",
    async () => {
      promptedSteps.delete(url)
      await popModal()
      await retrySpace(url)
    },
  )
</script>

<Modal tag="form" onsubmit={preventDefault(retry)}>
  <ModalBody>
    <ModalHeader>
      <ModalTitle>Can't reach this space</ModalTitle>
      <ModalSubtitle><RelayLabel {url} /></ModalSubtitle>
    </ModalHeader>
    <p>
      {#if reason === "silent"}
        The space accepted a connection but isn't answering.
      {:else}
        The space couldn't be reached. It may be down, or your network may be blocking it.
      {/if}
    </p>
  </ModalBody>
  <ModalFooter>
    <Button class="button button-link" onclick={back}>
      <Icon icon={AltArrowLeft} />
      Go Home
    </Button>
    <Button type="submit" class="button button-primary" disabled={$loading}>
      <Spinner loading={$loading}>
        <Icon icon={Refresh} />
        Retry
      </Spinner>
    </Button>
  </ModalFooter>
</Modal>
