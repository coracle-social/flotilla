<script lang="ts">
  import type {Snippet} from "svelte"
  import {take} from "@welshman/lib"
  import {sortEventsDesc} from "@welshman/util"
  import type {TrustedEvent} from "@welshman/util"
  import Button from "@lib/components/Button.svelte"
  import NoteItem from "@app/components/NoteItem.svelte"
  import {openEventNote} from "@app/navigation/overlays"

  type Props = {
    replies: TrustedEvent[]
    quoteNote: Snippet<[TrustedEvent]>
  }

  const {replies, quoteNote}: Props = $props()

  let showEvery = $state(false)

  const sorted = $derived(sortEventsDesc(replies))

  const shown = $derived(showEvery ? sorted : take(3, sorted))

  const openReply = (reply: TrustedEvent) => () => openEventNote(reply)

  const showAll = () => {
    showEvery = true
  }
</script>

{#if shown.length > 0}
  <div class="ml-4 flex flex-col gap-3 border-l border-line-less pt-3 pl-4">
    {#each shown as reply (reply.id)}
      <NoteItem
        event={reply}
        customActions={quoteNote}
        card={false}
        interactive
        showReply
        onOpen={openReply(reply)} />
    {/each}
    {#if shown.length < sorted.length}
      <Button class="link self-start text-sm" onclick={showAll}>
        Show {sorted.length - shown.length} more
      </Button>
    {/if}
  </div>
{/if}
