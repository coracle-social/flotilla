<script lang="ts">
  import Button from "@lib/components/Button.svelte"
  import ModalHeader from "@lib/components/ModalHeader.svelte"
  import RoomName from "@app/components/RoomName.svelte"
  import Profile from "@app/components/Profile.svelte"
  import {deriveRoomMembers} from "@app/core/state"

  interface Props {
    url: string
    h: string
  }

  const {url, h}: Props = $props()

  const members = deriveRoomMembers(url, h)
</script>

<div class="column gap-4">
  <ModalHeader>
    {#snippet title()}
      <div>Members</div>
    {/snippet}
    {#snippet info()}
      <div>of <RoomName {url} {h} /></div>
    {/snippet}
  </ModalHeader>
  {#each $members as pubkey (pubkey)}
    <div class="card2 bg-alt">
      <Profile {pubkey} />
    </div>
  {/each}
  <Button class="btn btn-primary" onclick={() => history.back()}>Got it</Button>
</div>
