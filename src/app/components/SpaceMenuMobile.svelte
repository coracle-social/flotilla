<script lang="ts">
  import Modal from "@lib/components/Modal.svelte"
  import ModalBody from "@lib/components/ModalBody.svelte"
  import SpaceMenuActionsMobile from "@app/components/SpaceMenuActionsMobile.svelte"

  type Props = {
    url: string
  }

  const {url}: Props = $props()
</script>

<Modal label="Space menu">
  <ModalBody>
    <div class="flex flex-col gap-2">
      <SpaceMenuActionsMobile {url} />
    </div>
  </ModalBody>
</Modal>
