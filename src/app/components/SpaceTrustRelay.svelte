<script lang="ts">
  import {preventDefault} from "@lib/html"
  import CloseCircle from "@assets/icons/close-circle.svg?dataurl"
  import CheckCircle from "@assets/icons/check-circle.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import Button from "@lib/components/Button.svelte"
  import Modal from "@lib/components/Modal.svelte"
  import ModalBody from "@lib/components/ModalBody.svelte"
  import ModalHeader from "@lib/components/ModalHeader.svelte"
  import ModalTitle from "@lib/components/ModalTitle.svelte"
  import ModalSubtitle from "@lib/components/ModalSubtitle.svelte"
  import ModalFooter from "@lib/components/ModalFooter.svelte"
  import RelayLabel from "@app/components/RelayLabel.svelte"
  import {publishRoomList} from "@app/features/spaces/rooms"
  import {addTrustedRelay, removeTrustedRelay} from "@app/core/settings"
  import {navigate} from "@app/navigation/navigate"
  import {popModal} from "@app/navigation/dialogs"
  import {roomLists} from "@app/core/plugins"
  import {pushToast} from "@app/features/toast"

  type Props = {
    url: string
  }

  const {url}: Props = $props()

  const untrustSpace = async () => {
    loading = true

    try {
      await $roomLists.removeRelay(url).then(publishRoomList)
      await removeTrustedRelay(url)
      navigate("/home")
    } catch (e) {
      console.error(e)
      pushToast({theme: "error", message: "Failed to leave the space."})
    } finally {
      loading = false
    }
  }

  const trustSpace = async () => {
    loading = true

    try {
      await addTrustedRelay(url)

      popModal()
    } catch (e) {
      console.error(e)
      pushToast({theme: "error", message: "Failed to trust this space."})
    } finally {
      loading = false
    }
  }

  let loading = $state(false)
</script>

<Modal tag="form" onsubmit={preventDefault(trustSpace)}>
  <ModalBody>
    <ModalHeader>
      <ModalTitle>Do you trust this space?</ModalTitle>
      <ModalSubtitle>
        Only join <RelayLabel {url} class="text-primary" /> if you trust the adminstrator
      </ModalSubtitle>
    </ModalHeader>
    <div class="m-auto flex flex-col gap-4">
      <p>
        Messages in this space can't be verified, which means its administrator could forge messages
        from other users.
      </p>
      <p>
        If you trust this space's admin, you can continue. Otherwise, it may be safer not to join
        this space.
      </p>
    </div>
  </ModalBody>
  <ModalFooter>
    <div class="flex flex-col gap-2 sm:flex-row sm:justify-between">
      <Button class="button button-neutral" onclick={untrustSpace} disabled={loading}>
        {#if !loading}
          <Icon icon={CloseCircle} />
        {/if}
        <Spinner {loading}>I don't trust this space</Spinner>
      </Button>
      <Button type="submit" class="button button-primary" disabled={loading}>
        {#if !loading}
          <Icon icon={CheckCircle} />
        {/if}
        <Spinner {loading}>I trust this space, continue</Spinner>
      </Button>
    </div>
  </ModalFooter>
</Modal>
