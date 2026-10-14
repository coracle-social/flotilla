<script lang="ts">
  import type {ComponentProps} from "svelte"
  import {Article} from "@welshman/domain"
  import {markdownToText} from "@lib/markdown"
  import ContentMinimal from "@app/components/ContentMinimal.svelte"
  import {reader} from "@app/core/domain"

  const props: ComponentProps<typeof ContentMinimal> = $props()

  const article = $derived(reader(Article)(props.event))
  const title = $derived(article.title())
  const summary = $derived(article.summary() || markdownToText(props.event.content))
</script>

{#if title}
  <span class="text-sm">{title}</span>
{/if}
{#if summary}
  <ContentMinimal {...props} event={{...props.event, content: summary}} />
{/if}
