<script lang="ts">
  import cx from "classnames"
  import type {Snippet} from "svelte"
  import {formatTimestamp} from "@welshman/lib"
  import type {TrustedEvent} from "@welshman/util"
  import Reply from "@assets/icons/reply-2.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import CommentTree from "@app/components/CommentTree.svelte"
  import CommentCompose from "@app/components/CommentCompose.svelte"
  import Profile from "@app/components/Profile.svelte"
  import ProfileName from "@app/components/ProfileName.svelte"
  import Content from "@app/components/Content.svelte"
  import CommentActions from "@app/components/CommentActions.svelte"
  import EventMenuButton from "@app/components/EventMenuButton.svelte"
  import EventReactions from "@app/components/EventReactions.svelte"
  import PublicationStatusOrDeleted from "@app/components/PublicationStatusOrDeleted.svelte"
  import type {FeedContext} from "@app/features/feeds"
  import Danger from "@assets/icons/danger-triangle.svg?dataurl"
  import {isEventMuted} from "@app/features/social/muting"
  import type {CommentNode} from "@app/features/social"

  type Props = {
    node: CommentNode
    root: TrustedEvent
    parent?: TrustedEvent
    depth?: number
    replyTo?: TrustedEvent
    setReplyTo?: (comment?: TrustedEvent) => void
    url?: string
    customActions?: Snippet<[TrustedEvent]>
    context: FeedContext
  }

  const {
    node,
    root,
    parent,
    depth = 1,
    replyTo,
    setReplyTo,
    url,
    customActions,
    context,
  }: Props = $props()

  // A level costs the text column about 50px, so indentation stops two levels in on a phone and four on a desktop.
  const phoneIndentCap = 2
  const desktopIndentCap = 4

  const indentClass = $derived(
    depth < phoneIndentCap
      ? "ml-4 border-l pl-7"
      : depth < desktopIndentCap
        ? "sm:ml-4 sm:border-l sm:pl-7"
        : "",
  )

  const atParentLevel = $derived(depth > phoneIndentCap)

  const atParentLevelOnDesktop = $derived(depth > desktopIndentCap)

  const composing = $derived(replyTo?.id === node.comment.id)

  const reply = () => setReplyTo?.(node.comment)

  const clearReplyTo = () => setReplyTo?.(undefined)

  const ignoreMute = () => {
    muted = false
  }

  let muted = $state($isEventMuted(node.comment))
</script>

{#snippet actions()}
  {@render customActions?.(node.comment)}
{/snippet}

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
    <div data-component="Comment" class="flex min-w-0 flex-col gap-1.5 py-3">
      <div class="flex items-start justify-between gap-2">
        <Profile pubkey={node.comment.pubkey} {url} avatarSize={8} />
        <span class="whitespace-nowrap text-sm opacity-75">
          {formatTimestamp(node.comment.created_at)}
        </span>
      </div>
      <!-- A reply past the cap sits at its parent's level, so it names who it answers. -->
      {#if parent && atParentLevel}
        <span class={cx("text-content-subtle text-xs", !atParentLevelOnDesktop && "sm:hidden")}>
          Replying to <ProfileName pubkey={parent.pubkey} {url} />
        </span>
      {/if}
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
            <EventReactions event={node.comment} {context} placement="left" />
            <EventMenuButton
              event={node.comment}
              noun="Comment"
              customActions={actions}
              class="rounded-full" />
          </PublicationStatusOrDeleted>
        {/if}
      </div>
    </div>
  {/if}
  {#if composing}
    <div class="pb-3">
      <CommentCompose
        {url}
        event={root}
        parent={node.comment}
        onCancel={clearReplyTo}
        onSubmit={clearReplyTo} />
    </div>
  {/if}
  {#if node.children.length > 0}
    <!-- The thread line marks the subtree and brightens while it is hovered. -->
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
          {customActions}
          {context} />
      {/each}
    </div>
  {/if}
</div>
