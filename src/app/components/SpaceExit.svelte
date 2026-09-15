<script lang="ts">
  import {navigate} from "@app/modal"
  import {displayRelayUrl} from "@welshman/util"
  import {preventDefault} from "@lib/html"
  import Spinner from "@lib/components/Spinner.svelte"
  import Button from "@lib/components/Button.svelte"
  import AltArrowLeft from "@assets/icons/alt-arrow-left.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Modal from "@lib/components/Modal.svelte"
  import ModalBody from "@lib/components/ModalBody.svelte"
  import ModalHeader from "@lib/components/ModalHeader.svelte"
  import ModalTitle from "@lib/components/ModalTitle.svelte"
  import ModalFooter from "@lib/components/ModalFooter.svelte"
  import {leaveSpace} from "@app/access"

  const {url} = $props()

  const back = () => history.back()

  const exit = async () => {
    loading = true

    try {
      await leaveSpace(url)
      await navigate("/home")
    } finally {
      loading = false
    }
  }

  let loading = $state(false)
</script>

<Modal tag="form" onsubmit={preventDefault(exit)}>
  <ModalBody>
    <ModalHeader>
      <ModalTitle>
        You are leaving<br /><span class="text-primary">{displayRelayUrl(url)}</span>
      </ModalTitle>
    </ModalHeader>
    <p class="text-center">Are you sure you want to leave?</p>
  </ModalBody>
  <ModalFooter>
    <Button class="button button-link" onclick={back}>
      <Icon icon={AltArrowLeft} />
      Go back
    </Button>
    <Button type="submit" class="button button-primary" disabled={loading}>
      <Spinner {loading}>Confirm</Spinner>
    </Button>
  </ModalFooter>
</Modal>
