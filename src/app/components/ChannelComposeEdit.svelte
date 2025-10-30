<script lang="ts">
  import {slide} from "@lib/transition"
  import CloseCircle from "@assets/icons/close-circle.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"

  const {
    clear,
  }: {
    clear: () => void
  } = $props()
</script>

<div
  class="relative flex h-8 items-center justify-between border-l-2 border-solid border-primary bg-base-300 px-2 pr-7 text-xs"
  transition:slide>
  <p class="text-primary">Editing message</p>
  <Button onclick={clear} class="flex items-center">
    <Icon icon={CloseCircle} />
  </Button>
</div>
