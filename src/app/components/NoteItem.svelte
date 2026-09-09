<script lang="ts">
  import type {Snippet} from "svelte"
  import type {NativeEmoji} from "emoji-picker-element/shared"
  import type {TrustedEvent, EventContent} from "@welshman/util"
  import {seen} from "@welshman/util"
  import SmileCircle from "@assets/icons/smile-circle.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import EmojiButton from "@lib/components/EmojiButton.svelte"
  import Cv from "@lib/components/Cv.svelte"
  import NoteContent from "@app/components/NoteContent.svelte"
  import {publishReaction, retractReaction} from "@app/reactions"
  import NoteCard from "@app/components/NoteCard.svelte"
  import ReactionSummary from "@app/components/ReactionSummary.svelte"
  import type {FeedContext} from "@app/feeds"
  import {router} from "@app/core"

  type Props = {
    event: TrustedEvent
    children?: Snippet
    context: FeedContext
    url?: string
    card?: boolean
  }

  const {url, event, children, context, card = true}: Props = $props()

  const getRelays = () => (url ? [url] : $router.resolver.relays([seen(event)]))

  const deleteReaction = async (reaction: TrustedEvent) =>
    retractReaction(reaction, {url, urls: await getRelays()})

  const createReaction = async (values: EventContent) =>
    publishReaction(event, values, {url, urls: await getRelays()})

  const onEmoji = (emoji: NativeEmoji) => createReaction({content: emoji.unicode, tags: []})
</script>

{#snippet body()}
  <NoteContent {event} expandMode="inline" />
  <div class="flex w-full justify-between gap-2">
    <ReactionSummary
      {url}
      {event}
      {context}
      {deleteReaction}
      {createReaction}
      reactionClass="tip-right">
      <EmojiButton
        {onEmoji}
        aria-label="Add a reaction"
        class="button button-neutral button-xs rounded-full">
        <Icon icon={SmileCircle} size={4} />
      </EmojiButton>
    </ReactionSummary>
    {@render children?.()}
  </div>
{/snippet}

{#if card}
  <Cv tag={NoteCard} {event} {url} class="card card-interactive">
    {@render body()}
  </Cv>
{:else}
  <NoteCard {event} {url}>
    {@render body()}
  </NoteCard>
{/if}
