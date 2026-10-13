<script lang="ts">
  import Login from "@assets/icons/login-3.svg?dataurl"
  import AddCircle from "@assets/icons/add-circle.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Link from "@lib/components/Link.svelte"
  import Button from "@lib/components/Button.svelte"
  import CardButton from "@lib/components/CardButton.svelte"
  import Modal from "@lib/components/Modal.svelte"
  import ModalBody from "@lib/components/ModalBody.svelte"
  import ModalHeader from "@lib/components/ModalHeader.svelte"
  import ModalTitle from "@lib/components/ModalTitle.svelte"
  import ModalSubtitle from "@lib/components/ModalSubtitle.svelte"
  import SpaceInviteAccept from "@app/components/SpaceInviteAccept.svelte"
  import {pushModal} from "@app/ui/modal"

  const startJoin = () => pushModal(SpaceInviteAccept)
</script>

<Modal>
  <ModalBody>
    <ModalHeader>
      <ModalTitle>Add a Space</ModalTitle>
      <ModalSubtitle
        >Spaces are places where communities come together to work, play, and hang out.</ModalSubtitle>
    </ModalHeader>
    <Button onclick={startJoin}>
      <CardButton primary>
        {#snippet icon()}
          <div><Icon icon={Login} size={7} /></div>
        {/snippet}
        {#snippet title()}
          <div>Join a space</div>
        {/snippet}
        {#snippet info()}
          <div>Enter an invite link to join an existing space.</div>
        {/snippet}
      </CardButton>
    </Button>
    <Link href="/spaces/create">
      <CardButton>
        {#snippet icon()}
          <div><Icon icon={AddCircle} size={7} /></div>
        {/snippet}
        {#snippet title()}
          <div>Create a space</div>
        {/snippet}
        {#snippet info()}
          <div>Just a few questions and you'll be on your way.</div>
        {/snippet}
      </CardButton>
    </Link>
  </ModalBody>
</Modal>
