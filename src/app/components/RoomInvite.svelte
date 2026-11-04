<script lang="ts">
  import UserPlus from "@assets/icons/user-plus.svg?dataurl"
  import Button from "@lib/components/Button.svelte"
  import Icon from "@lib/components/Icon.svelte"
  import Modal from "@lib/components/Modal.svelte"
  import ModalBody from "@lib/components/ModalBody.svelte"
  import ModalHeader from "@lib/components/ModalHeader.svelte"
  import ModalTitle from "@lib/components/ModalTitle.svelte"
  import ModalSubtitle from "@lib/components/ModalSubtitle.svelte"
  import ModalFooter from "@lib/components/ModalFooter.svelte"
  import InviteLink from "@app/components/InviteLink.svelte"
  import RoomMembersAdd from "@app/components/RoomMembersAdd.svelte"
  import RoomName from "@app/components/RoomName.svelte"
  import RelayLabel from "@app/components/RelayLabel.svelte"
  import {deriveRoomPermissions} from "@app/features/spaces/rooms"
  import {pushModal} from "@app/navigation/dialogs"

  type Props = {
    url: string
    h: string
  }

  const {url, h}: Props = $props()

  const permissions = deriveRoomPermissions(url, h)

  const back = () => history.back()

  const addMembers = () => pushModal(RoomMembersAdd, {url, h})
</script>

<Modal>
  <ModalBody>
    <ModalHeader>
      <ModalTitle>Create a Room Invite</ModalTitle>
      <ModalSubtitle>
        Get a link to invite people to
        <RoomName {url} {h} class="text-primary" />
        in <RelayLabel {url} class="text-primary" />
      </ModalSubtitle>
    </ModalHeader>
    <InviteLink {url} {h} />
  </ModalBody>
  <ModalFooter>
    {#if $permissions.addMembers}
      <Button class="button button-link" onclick={addMembers}>
        <Icon icon={UserPlus} />
        Add members
      </Button>
      <Button class="button button-primary" onclick={back}>Done</Button>
    {:else}
      <Button class="button button-primary grow" onclick={back}>Done</Button>
    {/if}
  </ModalFooter>
</Modal>
