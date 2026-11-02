<script lang="ts">
  import Button from "@lib/components/Button.svelte"
  import ModalHeader from "@lib/components/ModalHeader.svelte"
  import ModalTitle from "@lib/components/ModalTitle.svelte"
  import ModalFooter from "@lib/components/ModalFooter.svelte"
  import Modal from "@lib/components/Modal.svelte"
  import ModalBody from "@lib/components/ModalBody.svelte"
  import Profile from "@app/components/Profile.svelte"

  type Props = {
    pubkeys: string[]
  }

  const {pubkeys}: Props = $props()

  const back = () => history.back()
</script>

<Modal>
  <ModalBody>
    <ModalHeader>
      <ModalTitle>People in this conversation</ModalTitle>
    </ModalHeader>
    <div class="flex flex-col gap-2">
      {#each pubkeys as pubkey (pubkey)}
        <div class="card">
          <Profile {pubkey} />
        </div>
      {/each}
    </div>
  </ModalBody>
  <ModalFooter>
    <Button class="button button-primary" onclick={back}>Got it</Button>
  </ModalFooter>
</Modal>
