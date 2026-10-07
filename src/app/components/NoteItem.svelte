<script lang="ts">
  import cx from "classnames"
  import type {Snippet} from "svelte"
  import {COMMENT, NOTE} from "@welshman/util"
  import type {TrustedEvent} from "@welshman/util"
  import Reply from "@assets/icons/reply-2.svg?dataurl"
  import Button from "@lib/components/Button.svelte"
  import Icon from "@lib/components/Icon.svelte"
  import NoteContent from "@app/components/NoteContent.svelte"
  import EventMenuButton from "@app/components/EventMenuButton.svelte"
  import NoteCard from "@app/components/NoteCard.svelte"
  import NoteThreadLinks from "@app/components/NoteThreadLinks.svelte"
  import EventReactions from "@app/components/EventReactions.svelte"
  import Cv from "@lib/components/Cv.svelte"
  import type {FeedContext} from "@app/feeds"
  import {pushEventNote} from "@app/routes"

  type Props = {
    event: TrustedEvent
    children?: Snippet
    context: FeedContext
    url?: string
    card?: boolean
    interactive?: boolean
    onOpen?: () => void
    showEntire?: boolean
    showReply?: boolean
    showThreadLinks?: boolean
  }

  const {
    url,
    event,
    children,
    context,
    card = true,
    interactive = card,
    onOpen,
    showEntire = false,
    showReply = false,
    showThreadLinks = false,
  }: Props = $props()

  const related = context.related(event)

  // Kind 1 notes are replied to with notes as well as with NIP-22 comments.
  const replyCount = $derived($related.filter(e => e.kind === COMMENT || e.kind === NOTE).length)

  const openReplies = () => pushEventNote(event, {reply: true})
</script>

{#snippet body()}
  {#if showThreadLinks}
    <NoteThreadLinks {event} />
  {/if}
  <NoteContent {event} {showEntire} expandMode="inline" />
  <div class="flex w-full justify-between gap-2">
    <EventReactions {event} {context} {url} reactionClass="tip-right" />
    <div class="flex shrink-0 items-center gap-2">
      {#if showReply}
        <Button class="button button-neutral button-xs rounded-full" onclick={openReplies}>
          <Icon icon={Reply} size={4} />
          {#if replyCount === 0}
            Reply
          {:else}
            {replyCount}
            {replyCount === 1 ? "reply" : "replies"}
          {/if}
        </Button>
      {/if}
      {@render children?.()}
      <EventMenuButton {url} {event} noun="Note" class="rounded-full" />
    </div>
  </div>
{/snippet}

{#if card}
  <Cv tag={NoteCard} {event} {url} {interactive} {onOpen} class="card card-interactive">
    {@render body()}
  </Cv>
{:else}
  <NoteCard {event} {url} {interactive} {onOpen} class={cx({"cursor-pointer": interactive})}>
    {@render body()}
  </NoteCard>
{/if}
