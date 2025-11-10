<script lang="ts">
  import Icon from "@lib/components/Icon.svelte"

  type Props = {
    src: string
    alt: string
    size?: number
  }

  const {src, alt, size = 5}: Props = $props()
</script>

{#if src.includes("image/svg") || src.endsWith(".svg")}
  <Icon icon={src} {size} />
{:else}
  <img {src} {alt} class="h-{size} w-{size} rounded-lg object-cover" />
{/if}
