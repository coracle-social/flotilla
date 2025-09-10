<style>
  div {
    mask-repeat: none;
    mask-size: 100% 100%;
  }
</style>

<script lang="ts">
  const {
    icon,
    size = 5,
    ...restProps
  }: {
    icon: string
    size?: number
    class?: string
  } = $props()

  const px = size * 4
</script>

<div
  class="inline-block {restProps.class}"
  style="mask-image: url({icon}); width: {px}px; height: {px}px; min-width: {px}px; min-height: {px}px; background-color: currentcolor;">
</div>
