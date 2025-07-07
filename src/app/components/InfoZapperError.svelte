<script lang="ts">
  import {deriveZapperForPubkey} from "@welshman/app"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import ModalHeader from "@lib/components/ModalHeader.svelte"
  import ModalFooter from "@lib/components/ModalFooter.svelte"
  import ProfileLink from "@app/components/ProfileLink.svelte"

  const {pubkey} = $props()

  const zapper = deriveZapperForPubkey(pubkey)

  const back = () => history.back()
</script>

<div class="column gap-4">
  <ModalHeader>
    {#snippet title()}
      <div>Unable to Zap</div>
    {/snippet}
  </ModalHeader>
  <p>
    Zapping <ProfileLink {pubkey} class="!text-primary" /> isn't possible right now because
    {#if $zapper}
      their zap receiver isn't correctly set up.
    {:else}
      they don't currently have a zap receiver set up.
    {/if}
  </p>
  <ModalFooter>
    <Button class="btn btn-link" onclick={back}>
      <Icon icon="alt-arrow-left" />
      Go back
    </Button>
  </ModalFooter>
</div>
