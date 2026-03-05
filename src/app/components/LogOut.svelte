<script lang="ts">
  import {preventDefault} from "@lib/html"
  import AltArrowLeft from "@assets/icons/alt-arrow-left.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import Modal from "@lib/components/Modal.svelte"
  import ModalBody from "@lib/components/ModalBody.svelte"
  import ModalHeader from "@lib/components/ModalHeader.svelte"
  import ModalTitle from "@lib/components/ModalTitle.svelte"
  import ModalFooter from "@lib/components/ModalFooter.svelte"
  import {logout} from "@app/util/logout"

  const back = () => history.back()

  const doLogout = async () => {
    loading = true

    try {
      await logout()
    } catch (e) {
      console.error(e)
      loading = false
    }
  }

  let loading = $state(false)
</script>

<Modal tag="form" onsubmit={preventDefault(doLogout)}>
  <ModalBody>
    <ModalHeader>
      <ModalTitle>Are you sure you want<br />to log out?</ModalTitle>
    </ModalHeader>
    <p class="text-center">Your local database will be cleared.</p>
  </ModalBody>
  <ModalFooter>
    <Button class="btn btn-link" onclick={back}>
      <Icon icon={AltArrowLeft} />
      Go back
    </Button>
    <Button type="submit" class="btn btn-primary" disabled={loading}>
      <Spinner {loading}>Log Out</Spinner>
    </Button>
  </ModalFooter>
</Modal>
