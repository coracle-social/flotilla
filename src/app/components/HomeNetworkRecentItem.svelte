<script lang="ts">
  import {take} from "@welshman/lib"
  import type {Maybe} from "@welshman/lib"
  import {sortEventsDesc} from "@welshman/util"
  import type {TrustedEvent} from "@welshman/util"
  import Button from "@lib/components/Button.svelte"
  import NoteItem from "@app/components/NoteItem.svelte"
  import type {FeedContext} from "@app/feeds"
  import {pushEventNote} from "@app/routes"
  import {isEventMuted} from "@app/social"
  import type {NetworkFeedEntry} from "@app/social"

  type Props = {
    entry: NetworkFeedEntry
    // The note the entry is drawn around, which the feed resolves before drawing it.
    note: Maybe<TrustedEvent>
    context: FeedContext
  }

  const {entry, note, context}: Props = $props()

  // A muted person's note is not drawn above a reply to it that she has not muted.
  const anchor = $derived(note && !$isEventMuted(note) ? note : undefined)

  const replies = $derived(sortEventsDesc(entry.replies))

  let showEvery = $state(false)

  const shown = $derived(showEvery ? replies : take(3, replies))

  const openReply = (reply: TrustedEvent) => () => pushEventNote(reply)

  const showAll = () => {
    showEvery = true
  }
</script>

{#if anchor}
  <div class="flex flex-col gap-1">
    <NoteItem event={anchor} {context} showReply showThreadLinks />
    {#if shown.length > 0}
      <div class="ml-4 flex flex-col gap-3 border-l border-line-less pt-3 pl-4">
        {#each shown as reply (reply.id)}
          <NoteItem
            event={reply}
            {context}
            card={false}
            interactive
            showReply
            onOpen={openReply(reply)} />
        {/each}
        {#if shown.length < replies.length}
          <Button class="link self-start text-sm" onclick={showAll}>
            Show {replies.length - shown.length} more
          </Button>
        {/if}
      </div>
    {/if}
  </div>
{:else}
  {#each replies as reply (reply.id)}
    <NoteItem event={reply} {context} showReply showThreadLinks />
  {/each}
{/if}
