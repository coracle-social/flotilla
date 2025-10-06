<script lang="ts">
  import type {ComponentProps} from "svelte"
  import {getTagValue} from "@welshman/util"
  import ContentMinimal from "@app/components/ContentMinimal.svelte"

  const props: ComponentProps<typeof ContentMinimal> = $props()

  const title = getTagValue("title", props.event.tags)
</script>

{#if title}
  <span class="text-sm">{title}</span>
{/if}
{#if props.event.content}
  <ContentMinimal {...props} />
{/if}
