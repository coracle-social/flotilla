<script lang="ts">
  import {COMMENT, NOTE} from "@welshman/util"
  import type {TrustedEvent} from "@welshman/util"
  import Reply from "@assets/icons/reply-2.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import NoteItem from "@app/components/NoteItem.svelte"
  import type {FeedContext} from "@app/feeds"
  import {goToEvent} from "@app/routes"

  type Props = {
    event: TrustedEvent
    context: FeedContext
  }

  const {event, context}: Props = $props()

  const related = context.related(event)

  // Kind 1 notes are replied to with notes as well as with NIP-22 comments.
  const replyCount = $derived($related.filter(e => e.kind === COMMENT || e.kind === NOTE).length)

  const goToReplies = () => goToEvent(event)
</script>

<NoteItem {event} {context}>
  <Button class="button button-neutral button-xs rounded-full" onclick={goToReplies}>
    <Icon icon={Reply} size={4} />
    {replyCount}
    {replyCount === 1 ? "reply" : "replies"}
  </Button>
</NoteItem>
