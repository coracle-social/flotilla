<script lang="ts">
  import {onDestroy} from "svelte"
  import {readable} from "svelte/store"
  import type {IEventRef, TrustedEvent} from "@welshman/util"
  import Reply from "@assets/icons/reply-2.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import Modal from "@lib/components/Modal.svelte"
  import ModalBody from "@lib/components/ModalBody.svelte"
  import LoadingFallback from "@lib/components/LoadingFallback.svelte"
  import CommentCompose from "@app/components/CommentCompose.svelte"
  import CommentTree from "@app/components/CommentTree.svelte"
  import EventQuoteAction from "@app/components/EventQuoteAction.svelte"
  import NoteItem from "@app/components/NoteItem.svelte"
  import {makeFeedContext} from "@app/features/feeds"
  import {notes} from "@app/features/social"
  import type {CommentNode} from "@app/features/social"

  type Props = {
    ref: IEventRef
    reply?: boolean
  }

  const {ref, reply = false}: Props = $props()

  const context = makeFeedContext()
  const event = $notes.deriveEvent(ref)
  const replies = $derived($event ? $notes.deriveReplies($event) : readable<CommentNode[]>([]))

  const setReplyTo = (comment?: TrustedEvent) => {
    replyTo = comment
  }

  const clearReplyTo = () => setReplyTo(undefined)

  let replyTo: TrustedEvent | undefined = $state()
  let composerRaised = false

  // A reply button opens this modal composing, and cancelling it must not raise the composer again.
  $effect(() => {
    if (reply && $event && !composerRaised) {
      composerRaised = true
      setReplyTo($event)
    }
  })

  onDestroy(context.cleanup)
</script>

{#snippet quoteNote(event: TrustedEvent)}
  <EventQuoteAction {event} noun="Note" />
{/snippet}

{#snippet quoteComment(event: TrustedEvent)}
  <EventQuoteAction {event} noun="Comment" />
{/snippet}

<Modal label="Note">
  <ModalBody>
    {#if $event}
      {@const note = $event}
      {@const replyToNote = () => setReplyTo(note)}
      <div class="border-line flex flex-col gap-4 border-b pb-4">
        <NoteItem
          event={note}
          {context}
          customActions={quoteNote}
          card={false}
          showEntire
          showThreadLinks>
          {#if replyTo?.id !== note.id}
            <Button class="button button-neutral button-xs" onclick={replyToNote}>
              <Icon icon={Reply} size={4} />
              Reply
            </Button>
          {/if}
        </NoteItem>
        {#if replyTo?.id === note.id}
          <CommentCompose
            event={note}
            noun="Reply"
            onCancel={clearReplyTo}
            onSubmit={clearReplyTo} />
        {/if}
      </div>
      <div class="flex flex-col">
        {#each $replies as node (node.comment.id)}
          <CommentTree
            {node}
            root={note}
            {replyTo}
            {setReplyTo}
            customActions={quoteComment}
            {context} />
        {/each}
        {#if $replies.length === 0}
          <p class="py-2 text-sm opacity-75">No replies yet.</p>
        {/if}
      </div>
    {:else}
      <LoadingFallback
        loadingMessage="Loading note..."
        failureMessage="Failed to load note."
        retry={() => void $notes.load(ref)} />
    {/if}
  </ModalBody>
</Modal>
