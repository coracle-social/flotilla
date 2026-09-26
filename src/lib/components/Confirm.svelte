<script lang="ts">
  import {preventDefault} from "@lib/html"
  import AltArrowLeft from "@assets/icons/alt-arrow-left.svg?dataurl"
  import AltArrowRight from "@assets/icons/alt-arrow-right.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import ModalHeader from "@lib/components/ModalHeader.svelte"
  import ModalTitle from "@lib/components/ModalTitle.svelte"
  import ModalSubtitle from "@lib/components/ModalSubtitle.svelte"
  import ModalFooter from "@lib/components/ModalFooter.svelte"
  import Modal from "@lib/components/Modal.svelte"
  import ModalBody from "@lib/components/ModalBody.svelte"

  type Props = {
    title?: string
    subtitle?: string
    message: any
    confirm: any
  }

  const {subtitle = "", message, confirm, ...restProps}: Props = $props()

  let loading = $state(false)

  const tryConfirm = async () => {
    loading = true

    try {
      await confirm()
    } finally {
      loading = false
    }
  }

  const back = () => history.back()
</script>

<Modal tag="form" onsubmit={preventDefault(tryConfirm)}>
  <ModalBody>
    <ModalHeader>
      <ModalTitle>{restProps.title || "Are you sure?"}</ModalTitle>
      <ModalSubtitle>{subtitle}</ModalSubtitle>
    </ModalHeader>
    <p class="text-center">{message}</p>
  </ModalBody>
  <ModalFooter>
    <Button class="button button-link" onclick={back}>
      <Icon icon={AltArrowLeft} />
      Go back
    </Button>
    <Button type="submit" class="button button-primary" disabled={loading}>
      <Spinner {loading}>Confirm</Spinner>
      <Icon icon={AltArrowRight} />
    </Button>
  </ModalFooter>
</Modal>
