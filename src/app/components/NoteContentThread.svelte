<script lang="ts">
  import type {ComponentProps} from "svelte"
  import {formatTimestamp} from "@welshman/lib"
  import {getTagValue} from "@welshman/util"
  import Content from "@app/components/Content.svelte"

  const props: ComponentProps<typeof Content> = $props()

  const title = getTagValue("title", props.event.tags)
</script>

<div class="flex flex-col gap-2">
  {#if title}
    <div class="flex w-full items-center justify-between gap-2">
      <p class="text-xl">{title}</p>
      <p class="text-sm opacity-75">
        {formatTimestamp(props.event.created_at)}
      </p>
    </div>
  {:else}
    <p class="mb-3 h-0 text-xs opacity-75">
      {formatTimestamp(props.event.created_at)}
    </p>
  {/if}
  {#if props.event.content}
    <Content {...props} />
  {/if}
</div>
