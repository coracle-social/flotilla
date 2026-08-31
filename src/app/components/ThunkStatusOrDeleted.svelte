<script lang="ts">
  import type {Snippet} from "svelte"
  import type {TrustedEvent} from "@welshman/util"
  import {PublishStatus} from "@welshman/net"
  import ThunkStatus from "@app/components/ThunkStatus.svelte"
  import {thunks} from "@app/core"
  import type {FeedContext} from "@app/feeds"
  import {noThunks, thunksByEventId} from "@app/thunks"

  type Props = {
    event: TrustedEvent
    context: FeedContext
    status?: Snippet
    children?: Snippet
  }

  const {event, context, status, children}: Props = $props()
  const deleted = $derived(context.deleted(event))
  const pending = $derived($thunksByEventId.get(event.id) ?? noThunks)
  const thunk = $derived($thunks.merge(pending))
</script>

{#if $deleted}
  <div class="button button-error button-xs rounded-full">Deleted</div>
{:else}
  {#if $thunk.thunks.length > 0 && !$thunk.hasStatus(PublishStatus.Success)}
    <ThunkStatus {thunk} />
  {:else}
    {@render status?.()}
  {/if}
  {@render children?.()}
{/if}
