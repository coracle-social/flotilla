<script lang="ts">
  import {displayRelayUrl} from "@welshman/util"
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
  import SpaceMembersAdd from "@app/components/SpaceMembersAdd.svelte"
  import {deriveSpacePermissions} from "@app/management"
  import {pushModal} from "@app/modal"

  type Props = {
    url: string
  }

  const {url}: Props = $props()

  const permissions = deriveSpacePermissions(url)

  const back = () => history.back()

  const addMembers = () => pushModal(SpaceMembersAdd, {url})
</script>

<Modal>
  <ModalBody>
    <ModalHeader>
      <ModalTitle>Create an Invite</ModalTitle>
      <ModalSubtitle>
        Get a link that you can use to invite people to
        <span class="text-primary">{displayRelayUrl(url)}</span>
      </ModalSubtitle>
    </ModalHeader>
    <InviteLink {url} />
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
