<script lang="ts">
  import type {ComponentProps} from "svelte"
  import {Classified} from "@welshman/domain"
  import CurrencySymbol from "@lib/components/CurrencySymbol.svelte"
  import {reader} from "@app/core"
  import Content from "@app/components/Content.svelte"
  import ContentLinkBlock from "@app/components/ContentLinkBlock.svelte"

  const props: ComponentProps<typeof Content> = $props()

  const classified = $derived(reader(Classified)(props.event))
  const title = $derived(classified.title())
  const images = $derived(classified.images() ?? [])
  const price = $derived(classified.price())
</script>

<div class="@container flex flex-col gap-2">
  {#if title}
    <p class="text-xl">
      {title} —
      <CurrencySymbol code={price?.currency ?? "SAT"} />{price?.amount ?? 0}
    </p>
  {/if}
  {#if props.event.content}
    <Content {...props} />
  {/if}
  <div class="grid grid-cols-3 gap-2 @md:grid-cols-5 @2xl:grid-cols-9">
    {#each images as image, i (i + image)}
      <ContentLinkBlock event={props.event} value={{url: image}} />
    {/each}
  </div>
</div>
