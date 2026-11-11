<script lang="ts">
  import type {TrustedEvent} from "@welshman/util"
  import {Article} from "@welshman/domain"
  import ArticleExcerpt from "@app/components/ArticleExcerpt.svelte"
  import {reader} from "@app/core/domain"

  type Props = {
    event: TrustedEvent
  }

  const {event}: Props = $props()

  const article = $derived(reader(Article)(event))
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
  <ArticleExcerpt {event} />
</div>
