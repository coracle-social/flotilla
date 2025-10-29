<script lang="ts">
  import Login from "@assets/icons/login-3.svg?dataurl"
  import AddCircle from "@assets/icons/add-circle.svg?dataurl"
  import Compass from "@assets/icons/compass.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Link from "@lib/components/Link.svelte"
  import Button from "@lib/components/Button.svelte"
  import CardButton from "@lib/components/CardButton.svelte"
  import ModalHeader from "@lib/components/ModalHeader.svelte"
  import SpaceInviteAccept from "@app/components/SpaceInviteAccept.svelte"
  import {pushModal} from "@app/util/modal"

  type Props = {
    hideDiscover?: boolean
  }

  const {hideDiscover}: Props = $props()

  const startJoin = () => pushModal(SpaceInviteAccept)
</script>

<div class="column gap-2">
  <ModalHeader>
    {#snippet title()}
      <div>Add a Space</div>
    {/snippet}
    {#snippet info()}
      <div>Spaces are places where communities come together to work, play, and hang out.</div>
    {/snippet}
  </ModalHeader>
  {#if !hideDiscover}
    <Link href="/discover">
      <CardButton class="btn-primary">
        {#snippet icon()}
          <div><Icon icon={Compass} size={7} /></div>
        {/snippet}
        {#snippet title()}
          <div>Explore Spaces</div>
        {/snippet}
        {#snippet info()}
          <div>Join create, or browse spaces</div>
        {/snippet}
      </CardButton>
    </Link>
  {/if}
  <Button onclick={startJoin}>
    <CardButton class={hideDiscover ? "btn-primary" : "btn-neutral"}>
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
    <CardButton class="btn-neutral">
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
</div>
