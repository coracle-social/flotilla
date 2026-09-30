<script lang="ts">
  import Button from "@lib/components/Button.svelte"
  import Modal from "@lib/components/Modal.svelte"
  import ModalBody from "@lib/components/ModalBody.svelte"
  import ModalFooter from "@lib/components/ModalFooter.svelte"
  import ModalHeader from "@lib/components/ModalHeader.svelte"
  import ModalTitle from "@lib/components/ModalTitle.svelte"

  type Props = {
    title: string
    message: string
  }

  const {title, message}: Props = $props()

  const back = () => history.back()
</script>

<Modal>
  <ModalBody>
    <ModalHeader>
      <ModalTitle>{title}</ModalTitle>
    </ModalHeader>
    <p class="text-center">{message}</p>
  </ModalBody>
  <ModalFooter>
    <Button class="button button-primary" onclick={back}>Got it</Button>
  </ModalFooter>
</Modal>
