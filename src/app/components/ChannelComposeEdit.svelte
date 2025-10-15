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
  class="relative border-l-2 border-solid border-primary bg-base-300 px-2 py-1 pr-8 text-xs"
  transition:slide>
  <p class="text-primary">Editing message</p>
  <Button class="absolute right-2 top-2 cursor-pointer" onclick={clear}>
    <Icon icon={CloseCircle} />
  </Button>
</div>
