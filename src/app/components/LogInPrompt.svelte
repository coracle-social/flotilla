<script lang="ts">
  import AltArrowLeft from "@assets/icons/alt-arrow-left.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import Modal from "@lib/components/Modal.svelte"
  import ModalBody from "@lib/components/ModalBody.svelte"
  import ModalHeader from "@lib/components/ModalHeader.svelte"
  import ModalTitle from "@lib/components/ModalTitle.svelte"
  import ModalFooter from "@lib/components/ModalFooter.svelte"
  import LogInOptions from "@app/components/LogInOptions.svelte"

  type Props = {
    action: string
    onLogin: () => unknown
  }

  const {action, onLogin}: Props = $props()

  const back = () => history.back()
</script>

<Modal>
  <ModalBody>
    <ModalHeader>
      <ModalTitle>Log in to {action}</ModalTitle>
    </ModalHeader>
    <LogInOptions {onLogin} />
  </ModalBody>
  <ModalFooter>
    <Button class="button button-link" onclick={back}>
      <Icon icon={AltArrowLeft} />
      Not now
    </Button>
  </ModalFooter>
</Modal>
