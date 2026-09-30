<script lang="ts">
  import {onMount} from "svelte"
  import cx from "classnames"
  import {removeUndefined} from "@welshman/lib"
  import type {TrustedEvent} from "@welshman/util"
  import {getCommentFiltersForRoot} from "@welshman/util"
  import Reply from "@assets/icons/reply-2.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import CommentTree from "@app/components/CommentTree.svelte"
  import type {FeedContext} from "@app/feeds"
  import CommentCompose from "@app/components/CommentCompose.svelte"
  import {events, network} from "@app/core"
  import {buildCommentTree} from "@app/social"

  type Props = {
    event: TrustedEvent
    url?: string
    context: FeedContext
    columnClass?: string
    noun?: string
  }

  const {event, url, context, columnClass, noun = "post"}: Props = $props()

  const relays = removeUndefined([url])
  const filters = getCommentFiltersForRoot([event])
  const comments = $events.asc(filters).$

  const nodes = $derived(buildCommentTree(event, $comments))

  const setReplyTo = (comment?: TrustedEvent) => {
    replyTo = comment
  }

  const commentOnRoot = () => setReplyTo(event)

  const clearReplyTo = () => setReplyTo(undefined)

  let replyTo: TrustedEvent | undefined = $state()

  onMount(() => {
    if (relays.length > 0) {
      const controller = new AbortController()

      $network.request({relays, filters, signal: controller.signal})

      return () => controller.abort()
    }
  })
</script>

<section class="flex flex-col">
  <div class="border-b px-5 sm:px-8 border-line">
    <div class={cx("flex w-full flex-wrap items-center justify-between gap-2 py-3", columnClass)}>
      <h2 class="text-lg font-bold">
        {nodes.length === 0
          ? `Discussion about this ${noun}`
          : `${$comments.length} ${$comments.length === 1 ? "comment" : "comments"}`}
      </h2>
      {#if url && replyTo?.id !== event.id}
        <Button class="button button-primary button-sm" onclick={commentOnRoot}>
          <Icon icon={Reply} size={4} />
          Add a comment
        </Button>
      {/if}
    </div>
  </div>
  <div class="px-5 sm:px-8">
    <div class={cx("flex w-full flex-col pb-10", columnClass)}>
      {#if url && replyTo?.id === event.id}
        <div class="py-4">
          <CommentCompose {url} {event} onCancel={clearReplyTo} onSubmit={clearReplyTo} />
        </div>
      {/if}
      {#each nodes as node (node.comment.id)}
        <CommentTree {node} root={event} {replyTo} {setReplyTo} {url} {context} />
      {/each}
      {#if nodes.length === 0 && replyTo?.id !== event.id}
        <p class="py-6 text-sm opacity-60">No comments yet.</p>
      {/if}
    </div>
  </div>
</section>
