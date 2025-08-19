<script lang="ts">
  import type {NativeEmoji} from "emoji-picker-element/shared"
  import type {TrustedEvent, EventContent} from "@welshman/util"
  import Icon from "@lib/components/Icon.svelte"
  import EmojiButton from "@lib/components/EmojiButton.svelte"
  import NoteContent from "@app/components/NoteContent.svelte"
  import NoteCard from "@app/components/NoteCard.svelte"
  import ReactionSummary from "@app/components/ReactionSummary.svelte"
  import {publishDelete, publishReaction, canEnforceNip70} from "@app/commands"

  const {url, event} = $props()

  const shouldProtect = canEnforceNip70(url)

  const deleteReaction = async (event: TrustedEvent) =>
    publishDelete({relays: [url], event, protect: await shouldProtect})

  const createReaction = async (template: EventContent) =>
    publishReaction({...template, event, relays: [url], protect: await shouldProtect})

  const onEmoji = async (emoji: NativeEmoji) =>
    publishReaction({
      event,
      content: emoji.unicode,
      relays: [url],
      protect: await shouldProtect,
    })
</script>

<NoteCard {event} {url} class="card2 bg-alt">
  <NoteContent {event} expandMode="inline" />
  <div class="flex w-full justify-between gap-2">
    <ReactionSummary {url} {event} {deleteReaction} {createReaction} reactionClass="tooltip-right">
      <EmojiButton {onEmoji} class="btn btn-neutral btn-xs h-[26px] rounded-box">
        <Icon icon="smile-circle" size={4} />
      </EmojiButton>
    </ReactionSummary>
  </div>
</NoteCard>
