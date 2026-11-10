<script lang="ts">
  import {onDestroy} from "svelte"
  import {readable} from "svelte/store"
  import {removeUndefined, spec, uniqBy} from "@welshman/lib"
  import type {IEventRef, TrustedEvent} from "@welshman/util"
  import Modal from "@lib/components/Modal.svelte"
  import ModalBody from "@lib/components/ModalBody.svelte"
  import LoadingFallback from "@lib/components/LoadingFallback.svelte"
  import ReplyButton from "@lib/components/ReplyButton.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import CommentCompose from "@app/components/CommentCompose.svelte"
  import CommentTree from "@app/components/CommentTree.svelte"
  import EventQuoteAction from "@app/components/EventQuoteAction.svelte"
  import NoteItem from "@app/components/NoteItem.svelte"
  import {makeFeedContext} from "@app/features/feeds"
  import {getReplyRefs, notes} from "@app/features/social"
  import type {CommentNode} from "@app/features/social"

  type Props = {
    ref: IEventRef
    reply?: boolean
    thread?: boolean
  }

  const {ref, reply = false, thread = false}: Props = $props()

  const context = makeFeedContext({withReplies: true})
  const event = $notes.deriveEvent(ref)
  const replies = $derived($event ? $notes.deriveReplies($event) : readable<CommentNode[]>([]))

  const setReplyTo = (comment?: TrustedEvent) => {
    replyTo = comment
  }

  const clearReplyTo = () => setReplyTo(undefined)

  // A reply names only the event it answers, so the thread is walked up one parent at a time.
  const loadParents = async (child: TrustedEvent) => {
    const {parent} = getReplyRefs(child)
    const ancestor = parent ? await $notes.load(parent, {replies: [child]}) : undefined

    if (ancestor && !parents.some(spec({id: ancestor.id}))) {
      parents = [ancestor, ...parents]

      await loadParents(ancestor)
    }
  }

  // The root is fetched on its own, so a missing note partway up doesn't lose it.
  const loadThread = async (event: TrustedEvent) => {
    const {parent, root} = getReplyRefs(event)
    const parentsLoaded = loadParents(event)

    if (root && root.getIdOrAddress() !== parent?.getIdOrAddress()) {
      threadRoot = await $notes.load(root, {replies: [event]})
    }

    await parentsLoaded
  }

  let replyTo: TrustedEvent | undefined = $state()
  let threadRoot: TrustedEvent | undefined = $state()
  let parents: TrustedEvent[] = $state([])
  let loading = $state(thread)
  let composerRaised = false
  let threadRequested = false

  const ancestors = $derived(uniqBy(event => event.id, removeUndefined([threadRoot, ...parents])))

  // A reply button opens this modal composing, and cancelling it must not raise the composer again.
  $effect(() => {
    if (reply && $event && !composerRaised) {
      composerRaised = true
      setReplyTo($event)
    }
  })

  $effect(() => {
    if (thread && $event && !threadRequested) {
      threadRequested = true
      loadThread($event).finally(() => {
        loading = false
      })
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

<Modal label={thread ? "Thread" : "Note"}>
  <ModalBody>
    {#if $event}
      {@const note = $event}
      {@const replyToNote = () => setReplyTo(note)}
      {#if loading}
        <Spinner class="justify-center py-4" />
      {:else}
        {#each ancestors as event (event.id)}
          <div class="border-line border-b pb-4">
            <NoteItem
              {event}
              {context}
              customActions={quoteNote}
              card={false}
              interactive
              showReply />
          </div>
        {/each}
      {/if}
      <div class="border-line flex flex-col gap-4 border-b pb-4">
        <NoteItem
          event={note}
          {context}
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
