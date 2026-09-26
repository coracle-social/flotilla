<script lang="ts">
  import Stars from "@assets/icons/stars.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"

  type Props = {
    title: string
    description: string
    onfix: () => void
  }

  const {title, description, onfix}: Props = $props()
</script>

<div role="group" aria-label={title} class="flex items-center justify-between gap-3 px-4 py-3">
  <div class="flex min-w-0 flex-col gap-1">
    <strong class="text-sm">{title}</strong>
    <p class="text-sm opacity-75">{description}</p>
  </div>
  <Button class="button button-neutral button-sm shrink-0" onclick={onfix}>
    <Icon icon={Stars} size={4} />
    Fix
  </Button>
</div>
