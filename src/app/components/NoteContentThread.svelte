<script lang="ts">
  import type {ComponentProps} from "svelte"
  import {Thread} from "@welshman/domain"
  import Content from "@app/components/Content.svelte"
  import {reader} from "@app/core/domain"

  const props: ComponentProps<typeof Content> = $props()

  const title = reader(Thread)(props.event).title()
</script>

<div class="flex flex-col gap-2">
  {#if title}
    <p class="text-xl">{title}</p>
  {/if}
  {#if props.event.content}
    <Content {...props} />
  {/if}
</div>
