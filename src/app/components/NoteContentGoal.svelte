<script lang="ts">
  import type {ComponentProps} from "svelte"
  import {getTagValue} from "@welshman/util"
  import Content from "@app/components/Content.svelte"
  import GoalSummary from "@app/components/GoalSummary.svelte"

  const props: ComponentProps<typeof Content> = $props()

  const content = getTagValue("summary", props.event.tags)
  const fakeEvent = {content, tags: props.event.tags}
</script>

<div class="flex flex-col gap-2">
  <p class="text-2xl">{props.event.content}</p>
  <Content {...props} event={fakeEvent} expandMode="inline" minLength={50} maxLength={300} />
  <GoalSummary url={props.url} event={props.event} />
</div>
