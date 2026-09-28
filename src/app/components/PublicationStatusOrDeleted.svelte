<script lang="ts">
  import type {Snippet} from "svelte"
  import type {TrustedEvent} from "@welshman/util"
  import {PublishStatus} from "@welshman/net"
  import PublicationStatus from "@app/components/PublicationStatus.svelte"
  import {publisher} from "@app/core"
  import type {FeedContext} from "@app/feeds"
  import {noPublications, publicationsByEventId} from "@app/publications"

  type Props = {
    event: TrustedEvent
    context: FeedContext
    status?: Snippet
    children?: Snippet
  }

  const {event, context, status, children}: Props = $props()
  const deleted = $derived(context.deleted(event))
  const pending = $derived($publicationsByEventId.get(event.id) ?? noPublications)
  const group = $derived($publisher.merge(pending))
</script>

{#if $deleted}
  <div class="button button-error button-xs rounded-full">Deleted</div>
{:else}
  {#if $group.publications.length > 0 && !$group.hasStatus(PublishStatus.Success)}
    <PublicationStatus publication={group} inline />
  {:else}
    {@render status?.()}
  {/if}
  {@render children?.()}
{/if}
