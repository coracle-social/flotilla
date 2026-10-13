<script lang="ts">
  import type {ComponentProps} from "svelte"
  import {
    EVENT_TIME,
    ZAP_GOAL,
    THREAD,
    CLASSIFIED,
    HIGHLIGHT,
    LONG_FORM,
    POLL,
    PIN,
    PINBOARD,
  } from "@welshman/util"
  import NoteContentEventTime from "@app/components/NoteContentEventTime.svelte"
  import NoteContentThread from "@app/components/NoteContentThread.svelte"
  import NoteContentClassified from "@app/components/NoteContentClassified.svelte"
  import NoteContentHighlight from "@app/components/NoteContentHighlight.svelte"
  import NoteContentArticle from "@app/components/NoteContentArticle.svelte"
  import NoteContentGoal from "@app/components/NoteContentGoal.svelte"
  import NoteContentPoll from "@app/components/NoteContentPoll.svelte"
  import NoteContentPin from "@app/components/NoteContentPin.svelte"
  import NoteContentBoard from "@app/components/NoteContentBoard.svelte"
  import Content from "@app/components/Content.svelte"

  const props: ComponentProps<typeof Content> = $props()
</script>

{#key props.event.id}
  {#if props.event.kind === EVENT_TIME}
    <NoteContentEventTime {...props} />
  {:else if props.event.kind === THREAD}
    <NoteContentThread {...props} />
  {:else if props.event.kind === CLASSIFIED}
    <NoteContentClassified {...props} />
  {:else if props.event.kind === HIGHLIGHT}
    <NoteContentHighlight {...props} />
  {:else if props.event.kind === LONG_FORM}
    <NoteContentArticle {...props} />
  {:else if props.event.kind === ZAP_GOAL}
    <NoteContentGoal {...props} />
  {:else if props.event.kind === POLL}
    <NoteContentPoll {...props} />
  {:else if props.event.kind === PIN}
    <NoteContentPin {...props} />
  {:else if props.event.kind === PINBOARD}
    <NoteContentBoard {...props} />
  {:else}
    <Content {...props} />
  {/if}
{/key}
