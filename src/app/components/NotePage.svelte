<script lang="ts">
  import {onDestroy} from "svelte"
  import {readable} from "svelte/store"
  import {sleep} from "@welshman/lib"
  import type {TrustedEvent} from "@welshman/util"
  import Reply from "@assets/icons/reply-2.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import Page from "@lib/components/Page.svelte"
  import PageContent from "@lib/components/PageContent.svelte"
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

<Page>
  <PageContent noPad class="flex flex-col">
    {#if $event}
      {@const note = $event}
      {@const replyToNote = () => setReplyTo(note)}
      <div class="border-b border-line bg-surface px-4 py-4">
        <div class="mx-auto w-full max-w-[68ch]">
          <NoteItem event={note} {context} card={false} showEntire>
            {#if replyTo?.id !== note.id}
              <Button class="button button-neutral button-xs" onclick={replyToNote}>
                <Icon icon={Reply} size={4} />
                Reply
              </Button>
            {/if}
          </NoteItem>
        </div>
      </div>
      <div class="mx-auto w-full max-w-[68ch] px-4 pt-4">
        {#if replyTo?.id === note.id}
          <div class="pb-4">
            <CommentCompose
              event={note}
              noun="Reply"
              onCancel={clearReplyTo}
              onSubmit={clearReplyTo} />
          </div>
        {/if}
        {#each $replies as node (node.comment.id)}
          <CommentTree {node} root={note} {replyTo} {setReplyTo} {context} />
        {/each}
        {#if $replies.length === 0 && replyTo?.id !== note.id}
          <p class="py-6 text-sm opacity-75">No replies yet.</p>
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
  </PageContent>
</Page>
