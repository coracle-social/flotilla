<script lang="ts">
  import type {TrustedEvent} from "@welshman/util"
  import {deriveIsDeleted} from "@welshman/store"
  import {thunks, mergeThunks, repository} from "@welshman/app"
  import ThunkStatus from "@app/components/ThunkStatus.svelte"

  const {event}: {event: TrustedEvent} = $props()

  const deleted = deriveIsDeleted(repository, event)
  const thunk = $derived(mergeThunks($thunks.filter(t => t.event.id === event.id)))
</script>

{#if $deleted}
  <div class="btn btn-error btn-xs rounded-full">Deleted</div>
{:else if thunk}
  <ThunkStatus {thunk} />
{/if}
