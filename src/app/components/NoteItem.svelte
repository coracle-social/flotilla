<script lang="ts">
  import cx from "classnames"
  import {onMount} from "svelte"
  import type {Snippet} from "svelte"
  import type {TrustedEvent} from "@welshman/util"
  import ReplyButton from "@lib/components/ReplyButton.svelte"
  import NoteContent from "@app/components/NoteContent.svelte"
  import EventMenuButton from "@app/components/EventMenuButton.svelte"
  import NoteCard from "@app/components/NoteCard.svelte"
  import NoteThreadLinks from "@app/components/NoteThreadLinks.svelte"
  import EventReactions from "@app/components/EventReactions.svelte"
  import Cv from "@lib/components/Cv.svelte"
  import {events} from "@app/core/plugins"
  import {getRepliesFilters, loadReplies} from "@app/tools/interactions/interactions"
  import {isReplyTo} from "@app/tools/targets"
  import {openEventNote} from "@app/navigation/overlays"

  type Props = {
    event: TrustedEvent
    children?: Snippet
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
    customActions,
    card = true,
    interactive = card,
    onOpen,
    showEntire = false,
    showReply = false,
    showThreadLinks = false,
  }: Props = $props()

  const related = $events.desc(getRepliesFilters([event])).$

  // A kind 1 reply e-tags every note above it, so only the ones answering this note count.
  const replyCount = $derived($related.filter(e => isReplyTo(e, event)).length)

  const openReplies = () => openEventNote(event, {reply: true})

  onMount(() => loadReplies(event, url))
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
    <EventReactions {event} {url} placement="right" />
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
