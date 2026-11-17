<script lang="ts">
  import cx from "classnames"
  import type {Snippet} from "svelte"
  import type {TrustedEvent} from "@welshman/util"
  import ReplyButton from "@lib/components/ReplyButton.svelte"
  import NoteContent from "@app/components/NoteContent.svelte"
  import EventMenuButton from "@app/components/EventMenuButton.svelte"
  import NoteCard from "@app/components/NoteCard.svelte"
  import NoteThreadLinks from "@app/components/NoteThreadLinks.svelte"
  import EventReactions from "@app/components/EventReactions.svelte"
  import Cv from "@lib/components/Cv.svelte"
  import type {Interactions} from "@app/features/interactions"
  import {isReplyTo} from "@app/features/interactions"
  import {openEventNote} from "@app/navigation/overlays"

  type Props = {
    event: TrustedEvent
    children?: Snippet
    interactions: Interactions
    url?: string
    customActions?: Snippet<[TrustedEvent]>
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
    interactions,
    customActions,
    card = true,
    interactive = card,
    onOpen,
    showEntire = false,
    showReply = false,
    showThreadLinks = false,
  }: Props = $props()

  const related = interactions.related(event)

  // The index files an answer under every note above it, so only the ones naming this note count.
  const replyCount = $derived($related.filter(e => isReplyTo(e, event)).length)

  const openReplies = () => openEventNote(event, {reply: true})
</script>

{#snippet actions()}
  {@render customActions?.(event)}
{/snippet}

{#snippet body()}
  {#if showThreadLinks}
    <NoteThreadLinks {event} />
  {/if}
  <NoteContent {event} {showEntire} expandMode="inline" />
  <div class="flex w-full justify-between gap-2">
    <EventReactions {event} {interactions} {url} placement="right" />
    <div class="flex shrink-0 items-center gap-2">
      {#if showReply}
        <ReplyButton count={replyCount} onclick={openReplies} />
      {/if}
      {@render children?.()}
      <EventMenuButton {url} {event} noun="Note" customActions={actions} class="rounded-full" />
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
