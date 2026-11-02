<script lang="ts">
  import type {ComponentProps} from "svelte"
  import {Classified} from "@welshman/domain"
  import {reader} from "@app/core/domain"
  import ContentMinimal from "@app/components/ContentMinimal.svelte"

  const props: ComponentProps<typeof ContentMinimal> = $props()

  const classified = $derived(reader(Classified)(props.event))
  const title = $derived(classified.title())
</script>

{#if title}
  <span class="text-sm">{title}</span>
{/if}
{#if props.event.content}
  <ContentMinimal {...props} />
{/if}
