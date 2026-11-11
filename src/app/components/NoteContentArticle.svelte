<script lang="ts">
  import type {ComponentProps} from "svelte"
  import {Article} from "@welshman/domain"
  import ContentMarkdown from "@app/components/ContentMarkdown.svelte"
  import {reader} from "@app/core/domain"

  const props: ComponentProps<typeof ContentMarkdown> = $props()

  const article = $derived(reader(Article)(props.event))
  const title = $derived(article.title())
  const image = $derived(article.image())
</script>

<div class="flex flex-col gap-2">
  {#if image}
    <img src={image} alt="" class="h-40 w-full rounded-2xl object-cover" />
  {/if}
  {#if title}
    <p class="text-xl">{title}</p>
  {/if}
  {#if props.event.content}
    <ContentMarkdown event={props.event} class="content-markdown--excerpt" />
  {/if}
</div>
