<script lang="ts">
  import type {Snippet} from "svelte"
  import type {NativeEmoji} from "emoji-picker-element/shared"
  import type {TrustedEvent, EventContent} from "@welshman/util"
  import {Router} from "@welshman/router"
  import SmileCircle from "@assets/icons/smile-circle.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import EmojiButton from "@lib/components/EmojiButton.svelte"
  import NoteContent from "@app/components/NoteContent.svelte"
  import NoteCard from "@app/components/NoteCard.svelte"
  import ReactionSummary from "@app/components/ReactionSummary.svelte"
  import {publishDelete, publishReaction, canEnforceNip70} from "@app/core/commands"

  type Props = {
    event: TrustedEvent
    children?: Snippet
    url?: string
  }

  const {url, event, children}: Props = $props()

  const relays = url ? [url] : Router.get().Event(event).getUrls()

  const shouldProtect = url ? canEnforceNip70(url) : Promise.resolve(false)

  const deleteReaction = async (event: TrustedEvent) =>
    publishDelete({relays, event, protect: await shouldProtect})

  const createReaction = async (template: EventContent) =>
    publishReaction({...template, event, relays, protect: await shouldProtect})

  const onEmoji = async (emoji: NativeEmoji) =>
    publishReaction({
      event,
      relays,
      content: emoji.unicode,
      protect: await shouldProtect,
    })
</script>

<NoteCard {event} {url} class="card2 bg-alt">
  <NoteContent {event} expandMode="inline" />
  <div class="flex w-full justify-between gap-2">
    <ReactionSummary {url} {event} {deleteReaction} {createReaction} reactionClass="tooltip-right">
      <EmojiButton {onEmoji} class="btn btn-neutral btn-xs h-[26px] rounded-box">
        <Icon icon={SmileCircle} size={4} />
      </EmojiButton>
    </ReactionSummary>
    {@render children?.()}
  </div>
</NoteCard>
