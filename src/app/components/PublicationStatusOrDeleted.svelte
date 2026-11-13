<script lang="ts">
  import type {Snippet} from "svelte"
  import type {TrustedEvent} from "@welshman/util"
  import {PublishStatus} from "@welshman/net"
  import PublicationStatus from "@app/components/PublicationStatus.svelte"
  import {publisher} from "@app/core/plugins"
  import type {EngagementIndex} from "@app/features/engagement"
  import {noPublications, publicationsByEventId} from "@app/core/publications"

  type Props = {
    event: TrustedEvent
    engagement: EngagementIndex
    status?: Snippet
    children?: Snippet
  }

  const {event, engagement, status, children}: Props = $props()
  const deleted = $derived(engagement.deleted(event))
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
