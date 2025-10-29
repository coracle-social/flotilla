<script lang="ts">
  interface Props {
    title?: import("svelte").Snippet
    info?: import("svelte").Snippet
  }

  const {title, info}: Props = $props()
</script>

<div class="column m-auto max-w-xs gap-2 py-4">
  <h1 class="heading">{@render title?.()}</h1>
  <p class="text-center text-sm opacity-75">{@render info?.()}</p>
</div>
