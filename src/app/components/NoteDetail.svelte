<script lang="ts">
  import {onDestroy} from "svelte"
  import {readable} from "svelte/store"
  import {removeUndefined, uniqBy} from "@welshman/lib"
  import type {IEventRef, TrustedEvent} from "@welshman/util"
  import Modal from "@lib/components/Modal.svelte"
  import ModalBody from "@lib/components/ModalBody.svelte"
  import LoadingFallback from "@lib/components/LoadingFallback.svelte"
  import ReplyButton from "@lib/components/ReplyButton.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import CommentCompose from "@app/components/CommentCompose.svelte"
  import CommentTree from "@app/components/CommentTree.svelte"
  import EventQuoteAction from "@app/components/EventQuoteAction.svelte"
  import NoteDetail from "@app/components/NoteDetail.svelte"
  import NoteItem from "@app/components/NoteItem.svelte"
  import {pushModal} from "@app/navigation/dialogs"
  import {deriveNote, deriveReplies, loadNote, loadThread} from "@app/tools/notes"
  import type {CommentNode} from "@app/tools/notes"
  import {withLogin} from "@app/components/flows/login"

  type Props = {
    ref: IEventRef
    reply?: boolean
    thread?: boolean
    replyTo?: TrustedEvent
  }

  const {ref, reply = false, thread = false, replyTo: initialReplyTo}: Props = $props()

  const loaded = deriveNote(ref)
  const event = $derived($loaded)
  const replies = $derived(event ? deriveReplies(event) : readable<CommentNode[]>([]))

  // A thread opened as a dialog is replaced by the login dialogs, so a reply that waited on a login opens it again.
  const setReplyTo = (comment?: TrustedEvent) => {
    if (mounted) {
      replyTo = comment
    } else {
      pushModal(NoteDetail, {ref, thread, replyTo: comment}, {size: "large"})
    }
  }

  const clearReplyTo = () => setReplyTo(undefined)

  const retry = () => loadNote(ref)

  let replyTo: TrustedEvent | undefined = $state(initialReplyTo)
  let mounted = true
  let threadRoot: TrustedEvent | undefined = $state()
  let parents: TrustedEvent[] = $state([])
  let loading = $state(thread)
  let composerRaised = false
  let threadRequested = false

  const ancestors = $derived(uniqBy(event => event.id, removeUndefined([threadRoot, ...parents])))

  // A reply button opens this modal composing, and cancelling it must not raise the composer again.
  $effect(() => {
    if (reply && event && !composerRaised) {
      composerRaised = true
      setReplyTo(event)
    }
  })

  $effect(() => {
    if (thread && event && !threadRequested) {
      threadRequested = true
      // The ancestors of a threaded note arrive root first, nearest parent last.
      loadThread(event, chain => {
        threadRoot = chain.threadRoot
        parents = chain.parents
      })
        .catch(error => console.error(error))
        .finally(() => {
          loading = false
        })
    }
  })

  onDestroy(() => {
    mounted = false
  })
</script>

{#snippet quoteNote(event: TrustedEvent)}
  <EventQuoteAction {event} noun="Note" />
{/snippet}

{#snippet quoteComment(event: TrustedEvent)}
  <EventQuoteAction {event} noun="Comment" />
{/snippet}

<Modal label={thread ? "Thread" : "Note"}>
  <ModalBody>
    {#if event}
      {@const note = event}
      {@const replyToNote = () => withLogin(() => setReplyTo(note))}
      {#if loading}
        <Spinner class="justify-center py-4" />
      {/if}
      {#each ancestors as ancestor (ancestor.id)}
        <div class="border-line border-b pb-4">
          <NoteItem event={ancestor} customActions={quoteNote} card={false} interactive showReply />
        </div>
      {/each}
      <div class="border-line flex flex-col gap-4 border-b pb-4">
        <NoteItem
          event={note}
          customActions={quoteNote}
          card={false}
          showEntire
          showThreadLinks={!thread}>
          {#if replyTo?.id !== note.id}
            <ReplyButton count={$replies.length} onclick={replyToNote} />
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
          <CommentTree {node} root={note} {replyTo} {setReplyTo} customActions={quoteComment} />
        {/each}
        {#if $replies.length === 0}
          <p class="py-2 text-sm opacity-75">No replies yet.</p>
        {/if}
      </div>
    {:else}
      <LoadingFallback
        loadingMessage="Loading note..."
        failureMessage="Failed to load note."
        {retry} />
    {/if}
  </ModalBody>
</Modal>
