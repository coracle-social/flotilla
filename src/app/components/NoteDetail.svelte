<script lang="ts">
  import {onDestroy} from "svelte"
  import {readable} from "svelte/store"
  import {sleep} from "@welshman/lib"
  import type {TrustedEvent} from "@welshman/util"
  import Reply from "@assets/icons/reply-2.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import Modal from "@lib/components/Modal.svelte"
  import ModalBody from "@lib/components/ModalBody.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import CommentCompose from "@app/components/CommentCompose.svelte"
  import CommentTree from "@app/components/CommentTree.svelte"
  import NoteItem from "@app/components/NoteItem.svelte"
  import {makeFeedContext} from "@app/feeds"
  import {notes} from "@app/social"
  import type {CommentNode, NotePointer} from "@app/social"

  type Props = {
    pointer: NotePointer
  }

  const {pointer}: Props = $props()

  const relays = $notes.relays(pointer)
  const context = makeFeedContext({relays})
  const event = $notes.deriveEvent(pointer)
  const replies = $derived($event ? $notes.deriveReplies($event) : readable<CommentNode[]>([]))

  const setReplyTo = (comment?: TrustedEvent) => {
    replyTo = comment
  }

  const clearReplyTo = () => setReplyTo(undefined)

  let replyTo: TrustedEvent | undefined = $state()

  onDestroy(context.cleanup)
</script>

<Modal label="Note">
  <ModalBody>
    {#if $event}
      {@const note = $event}
      {@const replyToNote = () => setReplyTo(note)}
      <div class="border-line flex flex-col gap-4 border-b pb-4">
        <NoteItem event={note} {context} card={false} showEntire>
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
          <CommentTree {node} root={note} {replyTo} {setReplyTo} {context} />
        {/each}
        {#if $replies.length === 0}
          <p class="py-2 text-sm opacity-75">No replies yet.</p>
        {/if}
      </div>
    {:else}
      <div class="flex justify-center py-20">
        {#await sleep(5000)}
          <Spinner loading>Loading note...</Spinner>
        {:then}
          <p>Failed to load note.</p>
        {/await}
      </div>
    {/if}
  </ModalBody>
</Modal>
