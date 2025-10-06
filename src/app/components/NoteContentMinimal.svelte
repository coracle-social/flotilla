<script lang="ts">
  import type {ComponentProps} from "svelte"
  import {EVENT_TIME, ZAP_GOAL, THREAD} from "@welshman/util"
  import NoteContentMinimalEventTime from "@app/components/NoteContentMinimalEventTime.svelte"
  import NoteContentMinimalThread from "@app/components/NoteContentMinimalThread.svelte"
  import NoteContentMinimalGoal from "@app/components/NoteContentMinimalGoal.svelte"
  import ContentMinimal from "@app/components/ContentMinimal.svelte"

  const props: ComponentProps<typeof ContentMinimal> = $props()
</script>

<div class="text-xs">
  {#if props.event.kind === EVENT_TIME}
    <NoteContentMinimalEventTime {...props} />
  {:else if props.event.kind === THREAD}
    <NoteContentMinimalThread {...props} />
  {:else if props.event.kind === ZAP_GOAL}
    <NoteContentMinimalGoal {...props} />
  {:else}
    <ContentMinimal {...props} />
  {/if}
</div>
