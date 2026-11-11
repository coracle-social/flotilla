<script lang="ts">
  import type {TrustedEvent} from "@welshman/util"
  import {Article} from "@welshman/domain"
  import ContentMarkdown from "@app/components/ContentMarkdown.svelte"
  import {reader} from "@app/core/domain"

  type Props = {
    event: TrustedEvent
  }

  const {event}: Props = $props()

  const summary = $derived(reader(Article)(event).summary())
</script>

<!-- A summary is plain text by definition; a body is the article's own markdown, drawn and clipped. -->
{#if summary}
  <p class="line-clamp-3 text-content-muted">{summary}</p>
{:else if event.content}
  <ContentMarkdown {event} class="content-markdown--excerpt" />
{/if}
