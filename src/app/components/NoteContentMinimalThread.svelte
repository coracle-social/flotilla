<script lang="ts">
  import type {ComponentProps} from "svelte"
  import {Thread} from "@welshman/domain"
  import ContentMinimal from "@app/components/ContentMinimal.svelte"
  import {reader} from "@app/core"

  const props: ComponentProps<typeof ContentMinimal> = $props()

  const title = reader(Thread)(props.event).title()
</script>

{#if title}
  <span class="text-sm">{title}</span>
{/if}
{#if props.event.content}
  <ContentMinimal {...props} />
{/if}
