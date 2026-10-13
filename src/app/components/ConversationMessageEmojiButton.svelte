<script lang="ts">
  import type {TrustedEvent} from "@welshman/util"
  import SmileCircle from "@assets/icons/smile-circle.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import EmojiButton from "@lib/components/EmojiButton.svelte"
  import {publishWrappedReaction} from "@app/features/reactions"

  type Props = {
    event: TrustedEvent
    pubkeys: string[]
  }

  const {event, pubkeys}: Props = $props()

  const onEmoji = (emoji: string) =>
    publishWrappedReaction(event, {content: emoji, tags: []}, pubkeys)
</script>

<EmojiButton
  aria-label="Add a reaction"
  {onEmoji}
  class="button button-neutral button-xs join-item">
  <Icon icon={SmileCircle} size={4} />
</EmojiButton>
