<script lang="ts">
  import CloseCircle from "@assets/icons/close-circle.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import ComposeBar from "@app/components/ComposeBar.svelte"

  const {
    clear,
  }: {
    clear: () => void
  } = $props()
</script>

<ComposeBar class="flex h-8 items-center justify-between pr-7 text-xs">
  <p class="text-primary">Editing message</p>
  <Button onclick={clear} class="flex items-center">
    <Icon icon={CloseCircle} />
  </Button>
</ComposeBar>
