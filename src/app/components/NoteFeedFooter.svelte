<script lang="ts">
  import Spinner from "@lib/components/Spinner.svelte"
  import type {NoteFeedStatus} from "@app/tools/feeds/network"

  type Props = {
    status: NoteFeedStatus
    loading: boolean
    emptyMessage: string
    loadingMessage?: string
  }

  const {status, loading, emptyMessage, loadingMessage = "Loading..."}: Props = $props()

  const showLoading = $derived(status === "loading" || (status === "ready" && loading))
</script>

{#if status === "empty"}
  <p class="py-12 text-center text-sm opacity-75">{emptyMessage}</p>
{:else if showLoading}
  <p class="my-12 flex items-center justify-center gap-2">
    <Spinner loading />
    {loadingMessage}
  </p>
{/if}
