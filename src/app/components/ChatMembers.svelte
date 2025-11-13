<script lang="ts">
  import Button from "@lib/components/Button.svelte"
  import ModalHeader from "@lib/components/ModalHeader.svelte"
  import Profile from "@app/components/Profile.svelte"

  interface Props {
    pubkeys: string[]
  }

  const {pubkeys}: Props = $props()
</script>

<div class="column gap-4">
  <ModalHeader>
    {#snippet title()}
      <div>People in this conversation</div>
    {/snippet}
  </ModalHeader>
  {#each pubkeys as pubkey (pubkey)}
    <div class="card2 bg-alt">
      <Profile {pubkey} />
    </div>
  {/each}
  <Button class="btn btn-primary" onclick={() => history.back()}>Got it</Button>
</div>
