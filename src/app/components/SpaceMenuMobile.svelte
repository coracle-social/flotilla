<script lang="ts">
  import Modal from "@lib/components/Modal.svelte"
  import ModalBody from "@lib/components/ModalBody.svelte"
  import SpaceMenuActions from "@app/components/SpaceMenuActions.svelte"

  type Props = {
    url: string
  }

  const {url}: Props = $props()
</script>

<Modal label="Space menu">
  <ModalBody>
    <div class="flex flex-col gap-2">
      <SpaceMenuActions sheet {url} />
    </div>
  </ModalBody>
</Modal>
