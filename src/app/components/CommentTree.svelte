<script lang="ts">
  import cx from "classnames"
  import {formatTimestamp} from "@welshman/lib"
  import type {TrustedEvent} from "@welshman/util"
  import Reply from "@assets/icons/reply-2.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import CommentTree from "@app/components/CommentTree.svelte"
  import CommentCompose from "@app/components/CommentCompose.svelte"
  import ProfileCircle from "@app/components/ProfileCircle.svelte"
  import ProfileName from "@app/components/ProfileName.svelte"
  import ProfileDetail from "@app/components/ProfileDetail.svelte"
  import Content from "@app/components/Content.svelte"
  import CommentActions from "@app/components/CommentActions.svelte"
  import EventMenuButton from "@app/components/EventMenuButton.svelte"
  import EventReactions from "@app/components/EventReactions.svelte"
  import PublicationStatusOrDeleted from "@app/components/PublicationStatusOrDeleted.svelte"
  import type {FeedContext} from "@app/feeds"
  import Danger from "@assets/icons/danger-triangle.svg?dataurl"
  import {pushModal} from "@app/modal"
  import {isEventMuted} from "@app/social"
  import type {CommentNode} from "@app/social"

  type Props = {
    node: CommentNode
    root: TrustedEvent
    parent?: TrustedEvent
    depth?: number
    replyTo?: TrustedEvent
    setReplyTo?: (comment?: TrustedEvent) => void
    url?: string
    context: FeedContext
  }

  const {node, root, parent, depth = 1, replyTo, setReplyTo, url, context}: Props = $props()

  // A level costs the text column about 50px, so indentation stops two levels in on a phone and four on a desktop.
  const indentClass = $derived(
    depth < 2 ? "ml-4 border-l pl-7" : depth < 4 ? "sm:ml-4 sm:border-l sm:pl-7" : "",
  )

  const composing = $derived(replyTo?.id === node.comment.id)

  const reply = () => setReplyTo?.(node.comment)

  const clearReplyTo = () => setReplyTo?.(undefined)

  const openProfile = () => pushModal(ProfileDetail, {pubkey: node.comment.pubkey, url})

  const ignoreMute = () => {
    muted = false
  }

  let muted = $state($isEventMuted(node.comment))
</script>

<!-- Vertical rhythm lives on the individual blocks rather than the wrapper, so nesting
     doesn't compound padding at every level. -->
<div class="flex flex-col">
  {#if muted}
    <div class="flex flex-wrap items-center justify-between gap-2 py-3">
      <div class="text-content-muted flex items-center gap-2 text-sm">
        <Icon icon={Danger} size={4} />
        <p>You have muted this person.</p>
      </div>
      <Button class="button button-neutral button-xs" onclick={ignoreMute}>Show anyway</Button>
    </div>
  {:else}
    <div data-component="Comment" class="flex min-w-0 gap-3 py-3">
      <Button onclick={openProfile} class="shrink-0 self-start">
        <ProfileCircle pubkey={node.comment.pubkey} {url} size={8} />
      </Button>
      <div class="flex min-w-0 grow flex-col gap-1.5">
        <div class="flex flex-wrap items-baseline gap-x-2">
          <Button onclick={openProfile} class="text-sm font-bold hover:underline">
            <ProfileName pubkey={node.comment.pubkey} {url} />
          </Button>
          <span class="text-content-subtle text-xs">
            {formatTimestamp(node.comment.created_at)}
          </span>
          <!-- A reply past the cap sits at its parent's level, so it names who it answers. -->
          {#if parent && depth > 2}
            <span class={cx("text-content-subtle text-xs", depth < 5 && "sm:hidden")}>
              Replying to <ProfileName pubkey={parent.pubkey} {url} />
            </span>
          {/if}
        </div>
        <Content showEntire event={node.comment} {url} />
        <div class="mt-1 flex flex-wrap items-center justify-end gap-2">
          {#if setReplyTo}
            <Button class="button button-neutral button-xs mr-auto" onclick={reply}>
              <Icon icon={Reply} size={4} />
              Reply
            </Button>
          {/if}
          {#if url}
            <CommentActions event={node.comment} {url} {context} />
          {:else}
            <PublicationStatusOrDeleted event={node.comment} {context}>
              <EventReactions event={node.comment} {context} reactionClass="tip-left" />
              <EventMenuButton event={node.comment} noun="Comment" class="rounded-full" />
            </PublicationStatusOrDeleted>
          {/if}
        </div>
      </div>
    </div>
  {/if}
  {#if composing}
    <div class="ml-11 pb-3">
      <CommentCompose
        {url}
        event={root}
        parent={node.comment}
        onCancel={clearReplyTo}
        onSubmit={clearReplyTo} />
    </div>
  {/if}
  {#if node.children.length > 0}
    <!-- The thread line runs under the avatar's center and indents replies to line up with
         this comment's text column; it brightens while the subtree is hovered. -->
    <div
      data-component="CommentReplies"
      class={cx("border-line-less hover:border-line flex flex-col transition-colors", indentClass)}>
      {#each node.children as child (child.comment.id)}
        <CommentTree
          node={child}
          parent={node.comment}
          depth={depth + 1}
          {root}
          {replyTo}
          {setReplyTo}
          {url}
          {context} />
      {/each}
    </div>
  {/if}
</div>
