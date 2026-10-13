<script lang="ts">
  import type {Snippet} from "svelte"
  import Button from "@lib/components/Button.svelte"
  import ImageInputModal from "@app/components/ImageInputModal.svelte"
  import {pushModal} from "@app/ui/modal"

  type Props = {
    onSelect: (image: File | string) => void
    initialValue?: string
    children?: Snippet
    class?: string
    "aria-label"?: string
  }

  const {onSelect, initialValue, children, ...props}: Props = $props()

  const open = () => pushModal(ImageInputModal, {onSelect, initialValue}, {nested: true})
</script>

<Button onclick={open} {...props}>
  {@render children?.()}
</Button>
