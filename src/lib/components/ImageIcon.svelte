<script lang="ts">
  import Icon from "@lib/components/Icon.svelte"

  type Props = {
    src: string
    alt: string
    size?: number
    class?: string
  }

  const {src, alt, size = 5, ...props}: Props = $props()
</script>

{#if src.includes("image/svg") || src.endsWith(".svg")}
  <Icon icon={src} {size} class={props.class} />
{:else}
  <img
    {src}
    {alt}
    class="h-{size} w-{size} min-w-{size} min-h-{size} aspect-square object-cover {props.class}" />
{/if}
