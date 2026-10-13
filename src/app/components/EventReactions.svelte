<script lang="ts">
  import type {Placement} from "tippy.js"
  import type {TrustedEvent, EventContent} from "@welshman/util"
  import {seen} from "@welshman/util"
  import Bolt from "@assets/icons/bolt.svg?dataurl"
  import SmileCircle from "@assets/icons/smile-circle.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import EmojiButton from "@lib/components/EmojiButton.svelte"
  import ReactionSummary from "@app/components/ReactionSummary.svelte"
  import ZapButton from "@app/components/ZapButton.svelte"
  import {publishReaction, retractReaction} from "@app/features/reactions"
  import type {FeedContext} from "@app/features/feeds"
  import {router} from "@app/core/plugins"
  import {ENABLE_ZAPS} from "@app/core/env"

  type Props = {
    event: TrustedEvent
    context: FeedContext
    url?: string
    placement?: Placement
  }

  const {event, context, url, placement = "top"}: Props = $props()

  // A reaction goes where its subject lives: the space's own relay, or wherever the event was seen.
  const getRelays = () => (url ? [url] : $router.resolver.relays([seen(event)]))

  const deleteReaction = async (reaction: TrustedEvent) =>
    retractReaction(reaction, {url, urls: await getRelays()})

  const createReaction = async (values: EventContent) =>
    publishReaction(event, values, {url, urls: await getRelays()})

  const onEmoji = (emoji: string) => createReaction({content: emoji, tags: []})
</script>

<ReactionSummary {url} {event} {context} {deleteReaction} {createReaction} {placement}>
  {#if ENABLE_ZAPS}
    <ZapButton
      {url}
      {event}
      aria-label="Send a zap"
      class="button button-neutral button-xs rounded-full">
      <Icon icon={Bolt} size={4} />
    </ZapButton>
  {/if}
  <EmojiButton
    {onEmoji}
    aria-label="Add a reaction"
    class="button button-neutral button-xs rounded-full">
    <Icon icon={SmileCircle} size={4} />
  </EmojiButton>
</ReactionSummary>
