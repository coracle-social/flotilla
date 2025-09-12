<script lang="ts">
  import Compass from "@assets/icons/compass-big.svg?dataurl"
  import Login from "@assets/icons/login-3.svg?dataurl"
  import AddCircle from "@assets/icons/add-circle.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Link from "@lib/components/Link.svelte"
  import Button from "@lib/components/Button.svelte"
  import CardButton from "@lib/components/CardButton.svelte"
  import ModalHeader from "@lib/components/ModalHeader.svelte"
  import SpaceCreateExternal from "@app/components/SpaceCreateExternal.svelte"
  import SpaceInviteAccept from "@app/components/SpaceInviteAccept.svelte"
  import {pushModal} from "@app/util/modal"

  const startCreate = () => pushModal(SpaceCreateExternal)

  const startJoin = () => pushModal(SpaceInviteAccept)
</script>

<div class="column gap-4">
  <ModalHeader>
    {#snippet title()}
      <div>Add a Space</div>
    {/snippet}
    {#snippet info()}
      <div>Spaces are places where communities come together to work, play, and hang out.</div>
    {/snippet}
  </ModalHeader>
  <Link href="/discover">
    <CardButton class="btn-primary">
      {#snippet icon()}
        <div><Icon icon={Compass} size={7} /></div>
      {/snippet}
      {#snippet title()}
        <div>Discover spaces</div>
      {/snippet}
      {#snippet info()}
        <div>Browse spaces on the discover page.</div>
      {/snippet}
    </CardButton>
  </Link>
  <Button onclick={startJoin}>
    <CardButton class="dark:btn-neutral">
      {#snippet icon()}
        <div><Icon icon={Login} size={7} /></div>
      {/snippet}
      {#snippet title()}
        <div>Join a space</div>
      {/snippet}
      {#snippet info()}
        <div>Enter an invite code or url to join an existing space.</div>
      {/snippet}
    </CardButton>
  </Button>
  <Button onclick={startCreate}>
    <CardButton class="dark:btn-neutral">
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
  </Button>
</div>
