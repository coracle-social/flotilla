<script lang="ts">
  import type {ParsedEmojiValue} from "@welshman/content"

  export let value: ParsedEmojiValue

  const alt = `:${value.name}:`
</script>

{#if value.url}
  <img {alt} src={value.url} class="-mt-0.5 inline h-[1em] min-w-[1em] align-middle" />
{:else}
  {alt}
{/if}
