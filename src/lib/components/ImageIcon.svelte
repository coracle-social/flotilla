<script lang="ts">
  import Icon from "@lib/components/Icon.svelte"

  type Props = {
    src: string
    alt: string
  }

  const {src, alt}: Props = $props()
</script>

{#if src.includes("image/svg") || src.endsWith(".svg")}
  <Icon icon={src} />
{:else}
  <img {src} {alt} class="h-5 w-5 rounded-lg object-cover" />
{/if}
