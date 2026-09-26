<script lang="ts">
  import {displayRelayUrl} from "@welshman/util"
  import Button from "@lib/components/Button.svelte"
  import Modal from "@lib/components/Modal.svelte"
  import ModalBody from "@lib/components/ModalBody.svelte"
  import ModalHeader from "@lib/components/ModalHeader.svelte"
  import ModalTitle from "@lib/components/ModalTitle.svelte"
  import ModalSubtitle from "@lib/components/ModalSubtitle.svelte"
  import ModalFooter from "@lib/components/ModalFooter.svelte"
  import InviteLink from "@app/components/InviteLink.svelte"
  import RoomName from "@app/components/RoomName.svelte"

  type Props = {
    url: string
    h: string
  }

  const {url, h}: Props = $props()

  const back = () => history.back()
</script>

<Modal>
  <ModalBody>
    <ModalHeader>
      <ModalTitle>Create a Room Invite</ModalTitle>
      <ModalSubtitle>
        Get a link to invite people to
        <RoomName {url} {h} class="text-primary" />
        in <span class="text-primary">{displayRelayUrl(url)}</span>
      </ModalSubtitle>
    </ModalHeader>
    <InviteLink {url} {h} />
  </ModalBody>
  <ModalFooter>
    <Button class="button button-primary grow" onclick={back}>Done</Button>
  </ModalFooter>
</Modal>
