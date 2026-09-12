<script lang="ts">
  import Modal from "@lib/components/Modal.svelte"
  import ModalBody from "@lib/components/ModalBody.svelte"
  import IconPicker from "@app/components/IconPicker.svelte"

  type Props = {
    onSelect: (iconUrl: string) => void
  }

  const {onSelect}: Props = $props()
</script>

<Modal label="Choose an icon">
  <ModalBody>
    <IconPicker {onSelect} />
  </ModalBody>
</Modal>
