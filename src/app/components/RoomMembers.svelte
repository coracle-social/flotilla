<script lang="ts">
  import AddCircle from "@assets/icons/add-circle.svg?dataurl"
  import AltArrowLeft from "@assets/icons/alt-arrow-left.svg?dataurl"
  import Button from "@lib/components/Button.svelte"
  import Icon from "@lib/components/Icon.svelte"
  import MenuButton from "@lib/components/MenuButton.svelte"
  import Modal from "@lib/components/Modal.svelte"
  import ModalBody from "@lib/components/ModalBody.svelte"
  import ModalFooter from "@lib/components/ModalFooter.svelte"
  import ModalHeader from "@lib/components/ModalHeader.svelte"
  import ModalTitle from "@lib/components/ModalTitle.svelte"
  import ModalSubtitle from "@lib/components/ModalSubtitle.svelte"
  import Profile from "@app/components/Profile.svelte"
  import RoomName from "@app/components/RoomName.svelte"
  import RoomMembersAdd from "@app/components/RoomMembersAdd.svelte"
  import RoomMemberMenu from "@app/components/RoomMemberMenu.svelte"
  import {deriveRoomMembers, deriveUserIsRoomAdmin} from "@app/rooms"
  import {pushModal} from "@app/modal"

  type Props = {
    url: string
    h: string
  }

  const {url, h}: Props = $props()

  const members = deriveRoomMembers(url, h)
  const userIsAdmin = deriveUserIsRoomAdmin(url, h)

  const back = () => history.back()

  const addMember = () => pushModal(RoomMembersAdd, {url, h})
</script>

<Modal>
  <ModalBody>
    <ModalHeader>
      <ModalTitle>Members</ModalTitle>
      <ModalSubtitle>
        of <RoomName {url} {h} class="text-primary" />
      </ModalSubtitle>
    </ModalHeader>
    <div class="flex flex-col gap-2">
      {#if $members === undefined}
        <div class="card bg-surface p-4">
          <span class="text-error">Member list not available from this relay</span>
        </div>
      {:else if $members.length === 0}
        <div class="card bg-surface p-4">
          <span class="text-content-muted">No members yet</span>
        </div>
      {:else}
        {#each $members as pubkey (pubkey)}
          <div class="card relative">
            <div class="flex items-center justify-between gap-2">
              <div class="min-w-0 flex-1">
                <Profile {pubkey} {url} />
              </div>
              <MenuButton component={RoomMemberMenu} componentProps={{url, h, pubkey}} />
            </div>
          </div>
        {/each}
      {/if}
    </div>
  </ModalBody>
  <ModalFooter>
    <Button class="button button-link" onclick={back}>
      <Icon icon={AltArrowLeft} />
      Go back
    </Button>
    {#if $userIsAdmin}
      <Button class="button button-primary" onclick={addMember}>
        <Icon icon={AddCircle} />
        Add members
      </Button>
    {/if}
  </ModalFooter>
</Modal>
