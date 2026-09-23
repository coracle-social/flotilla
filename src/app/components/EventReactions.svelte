<script lang="ts">
  import type {NativeEmoji} from "emoji-picker-element/shared"
  import type {TrustedEvent, EventContent} from "@welshman/util"
  import {seen} from "@welshman/util"
  import SmileCircle from "@assets/icons/smile-circle.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import EmojiButton from "@lib/components/EmojiButton.svelte"
  import ReactionSummary from "@app/components/ReactionSummary.svelte"
  import {publishReaction, retractReaction} from "@app/reactions"
  import type {FeedContext} from "@app/feeds"
  import {router} from "@app/core"

  type Props = {
    event: TrustedEvent
    context: FeedContext
    url?: string
    reactionClass?: string
  }

  const {event, context, url, reactionClass = ""}: Props = $props()

  // A reaction goes where the thing it is about lives: the space's own relay in a space, and
  // wherever the event has been seen outside one.
  const getRelays = () => (url ? [url] : $router.resolver.relays([seen(event)]))

  const deleteReaction = async (reaction: TrustedEvent) =>
    retractReaction(reaction, {url, urls: await getRelays()})

  const createReaction = async (values: EventContent) =>
    publishReaction(event, values, {url, urls: await getRelays()})

  const onEmoji = (emoji: NativeEmoji) => createReaction({content: emoji.unicode, tags: []})
</script>

<ReactionSummary {url} {event} {context} {deleteReaction} {createReaction} {reactionClass}>
  <EmojiButton
    {onEmoji}
    aria-label="Add a reaction"
    class="button button-neutral button-xs rounded-full">
    <Icon icon={SmileCircle} size={4} />
  </EmojiButton>
</ReactionSummary>
