<script lang="ts">
  import {displayRelayUrl} from "@welshman/util"
  import {preventDefault} from "@lib/html"
  import AltArrowLeft from "@assets/icons/alt-arrow-left.svg?dataurl"
  import ServerPath from "@assets/icons/server-path.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import Button from "@lib/components/Button.svelte"
  import Modal from "@lib/components/Modal.svelte"
  import ModalBody from "@lib/components/ModalBody.svelte"
  import ModalHeader from "@lib/components/ModalHeader.svelte"
  import ModalTitle from "@lib/components/ModalTitle.svelte"
  import ModalSubtitle from "@lib/components/ModalSubtitle.svelte"
  import ModalFooter from "@lib/components/ModalFooter.svelte"
  import {roomLists} from "@app/core/plugins"
  import {publishRoomList} from "@app/features/rooms"
  import {goToMovedSpace} from "@app/ui/routes"
  import {pushToast} from "@app/ui/toast"

  type Props = {
    url: string
    newUrl: string
  }

  const {url, newUrl}: Props = $props()

  const back = () => history.back()

  const confirm = async () => {
    loading = true

    try {
      await $roomLists
        .migrateRelay(url, newUrl)
        .then(command => command && publishRoomList(command))
      await goToMovedSpace(url, newUrl)
    } catch (e) {
      console.error(e)
      pushToast({theme: "error", message: "Failed to move to the new space."})
    } finally {
      loading = false
    }
  }

  let loading = $state(false)
</script>

<Modal tag="form" onsubmit={preventDefault(confirm)}>
  <ModalBody>
    <ModalHeader>
      <div class="flex justify-center">
        <Icon icon={ServerPath} size={8} class="text-primary" />
      </div>
      <ModalTitle>This space has moved</ModalTitle>
      <ModalSubtitle>
        <span class="text-primary">{displayRelayUrl(url)}</span>
        is now located at
        <span class="text-primary">{displayRelayUrl(newUrl)}</span>.
      </ModalSubtitle>
    </ModalHeader>
    <p class="text-center">
      Would you like to update your spaces list to point at the new address?
    </p>
  </ModalBody>
  <ModalFooter>
    <Button class="button button-link" onclick={back} disabled={loading}>
      <Icon icon={AltArrowLeft} />
      Not now
    </Button>
    <Button type="submit" class="button button-primary" disabled={loading}>
      <Spinner {loading}>Update and go</Spinner>
    </Button>
  </ModalFooter>
</Modal>
