<script lang="ts">
  import type {ComponentProps} from "svelte"
  import {Highlight} from "@welshman/domain"
  import Content from "@app/components/Content.svelte"
  import ContentEvent from "@app/components/ContentEvent.svelte"
  import ContentLinkUrl from "@app/components/ContentLinkUrl.svelte"
  import ContentMention from "@app/components/ContentMention.svelte"
  import {reader} from "@app/core/domain"

  const props: ComponentProps<typeof Content> = $props()

  const highlight = $derived(reader(Highlight)(props.event))
  const comment = $derived(highlight.comment())
  const attributions = $derived(highlight.attributions())
  const source = $derived(highlight.sources()[0])

  const sourceEvent = $derived.by(() => {
    if (source?.type === "event") {
      return {value: source.id, relays: source.relay ? [source.relay] : []}
    }

    if (source?.type === "address") {
      return {value: source.address, relays: source.relay ? [source.relay] : []}
    }
  })

  // An external source is a url or an identifier like isbn:9780140328721.
  const sourceText = $derived.by(() => {
    if (source?.type === "reference") {
      return source.value
    }

    if (source?.type === "external") {
      return source.id
    }

    return ""
  })

  const sourceUrl = $derived(sourceText.match(/^https?:\/\//) ? sourceText : "")
</script>

<div class="flex flex-col gap-2">
  {#if comment}
    <Content {...props} event={{...props.event, content: comment}} />
  {/if}
  {#if props.event.content}
    <div class="border-l-primary border-l-2 border-solid pl-3">
      <Content {...props} />
    </div>
  {/if}
  {#if sourceEvent}
    <ContentEvent url={props.url} value={sourceEvent.value} relays={sourceEvent.relays} />
  {/if}
  {#if sourceText || attributions.length > 0}
    <div class="text-content-muted flex flex-wrap items-center gap-1 text-sm">
      {#if sourceUrl}
        <span>Highlighted from</span>
        <ContentLinkUrl url={sourceUrl} class="link-content" />
      {:else if sourceText}
        <span>Highlighted from {sourceText}</span>
      {/if}
      {#if attributions.length > 0}
        <span>by</span>
        {#each attributions as attribution (attribution.pubkey)}
          <ContentMention value={{pubkey: attribution.pubkey}} url={props.url} />
        {/each}
      {/if}
    </div>
  {/if}
</div>
