<script lang="ts">
  import Spinner from "@lib/components/Spinner.svelte"

  type Props = {
    loading: boolean
    exhausted: boolean
    isEmpty: boolean
    loadingMessage: string
    emptyMessage: string
    doneMessage?: string
  }

  const {loading, exhausted, isEmpty, loadingMessage, emptyMessage, doneMessage}: Props = $props()
</script>

<p class="flex h-10 items-center justify-center py-20">
  <Spinner {loading}>
    {#if loading}
      {loadingMessage}
    {:else if exhausted && isEmpty}
      {emptyMessage}
    {:else if exhausted}
      {doneMessage}
    {/if}
  </Spinner>
</p>
