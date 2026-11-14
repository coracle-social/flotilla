<script lang="ts">
  import cx from "classnames"
  import type {Snippet} from "svelte"
  import type {TrustedEvent} from "@welshman/util"
  import ReplyButton from "@lib/components/ReplyButton.svelte"
  import CommentTree from "@app/components/CommentTree.svelte"
  import CommentCompose from "@app/components/CommentCompose.svelte"
  import NoteCard from "@app/components/NoteCard.svelte"
  import ProfileName from "@app/components/ProfileName.svelte"
  import Content from "@app/components/Content.svelte"
  import CommentActions from "@app/components/CommentActions.svelte"
  import EventMenuButton from "@app/components/EventMenuButton.svelte"
  import EventReactions from "@app/components/EventReactions.svelte"
  import PublicationStatusOrDeleted from "@app/components/PublicationStatusOrDeleted.svelte"
  import type {Engagement} from "@app/features/engagement"
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
    engagement: Engagement
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
    engagement,
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
</script>

{#snippet actions()}
  {@render customActions?.(node.comment)}
{/snippet}

<!-- Vertical rhythm lives on the individual blocks rather than the wrapper, so nesting
     doesn't compound padding at every level. -->
<div class="flex flex-col">
  <div data-component="Comment" class="py-3">
    <NoteCard event={node.comment} {url} class="min-w-0">
      <!-- A reply past the cap sits at its parent's level, so it names who it answers. -->
      {#if parent && atParentLevel}
        <span class={cx("text-content-subtle text-xs", !atParentLevelOnDesktop && "sm:hidden")}>
          Replying to <ProfileName pubkey={parent.pubkey} />
        </span>
      {/if}
      <Content showEntire event={node.comment} {url} />
      {#if url}
        <div class="flex flex-wrap items-center justify-end gap-2">
          {#if setReplyTo}
            <ReplyButton count={node.children.length} onclick={reply} class="mr-auto" />
          {/if}
          <CommentActions event={node.comment} {url} {engagement} />
        </div>
      {:else}
        <div class="flex w-full justify-between gap-2">
          <EventReactions event={node.comment} {engagement} placement="right" />
          <div class="flex shrink-0 items-center gap-2">
            <PublicationStatusOrDeleted event={node.comment}>
              {#if setReplyTo}
                <ReplyButton count={node.children.length} onclick={reply} />
              {/if}
              <EventMenuButton
                event={node.comment}
                noun="Comment"
                customActions={actions}
                class="rounded-full" />
            </PublicationStatusOrDeleted>
          </div>
        </div>
      {/if}
    </NoteCard>
  </div>
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
          {engagement} />
      {/each}
    </div>
  {/if}
</div>
