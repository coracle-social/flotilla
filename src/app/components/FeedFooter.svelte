<script lang="ts">
  import Spinner from "@lib/components/Spinner.svelte"
  import type {PagerStatus} from "@lib/pager"

  type Props = {
    status: PagerStatus
    isEmpty: boolean
    loadingMessage: string
    emptyMessage: string
    doneMessage?: string
  }

  const {status, isEmpty, loadingMessage, emptyMessage, doneMessage}: Props = $props()

  const loading = $derived(status === "loading")
  const exhausted = $derived(status === "exhausted")
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
