<script lang="ts">
  import {sortBy} from "@welshman/lib"
  import {COMMENT, NOTE} from "@welshman/util"
  import type {TrustedEvent} from "@welshman/util"
  import NoteItem from "@app/components/NoteItem.svelte"
  import CommentTree from "@app/components/CommentTree.svelte"
  import type {FeedContext} from "@app/feeds"
  import {buildCommentTree} from "@app/social"

  type Props = {
    event: TrustedEvent
    context: FeedContext
  }

  const {event, context}: Props = $props()

  const related = context.related(event)

  // buildCommentTree adopts a comment whose parent never loaded, and reads oldest first so
  // that it adopts a parent before its own children.
  const nodes = $derived(
    buildCommentTree(
      event,
      sortBy(
        e => e.created_at,
        $related.filter(e => e.kind === COMMENT || e.kind === NOTE),
      ),
    ),
  )
</script>

<div class="cv card card-interactive flex flex-col gap-3">
  <NoteItem {event} {context} class="" />
  {#if nodes.length > 0}
    <div class="border-line-less flex flex-col border-t">
      {#each nodes as node (node.comment.id)}
        <CommentTree {node} root={event} {context} maxDepth={2} />
      {/each}
    </div>
  {/if}
</div>
