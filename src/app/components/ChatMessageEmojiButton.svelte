<script lang="ts">
  import type {NativeEmoji} from "emoji-picker-element/shared"
  import type {TrustedEvent} from "@welshman/util"
  import SmileCircle from "@assets/icons/smile-circle.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import EmojiButton from "@lib/components/EmojiButton.svelte"
  import {reactions, wraps} from "@app/core"

  type Props = {
    event: TrustedEvent
    pubkeys: string[]
  }

  const {event, pubkeys}: Props = $props()

  const onEmoji = async (emoji: NativeEmoji) => {
    const reaction = await $reactions.react(event, emoji.unicode)

    return $wraps.publish({event: reaction.event, recipients: pubkeys, pow: 16})
  }
</script>

<EmojiButton
  aria-label="Add a reaction"
  {onEmoji}
  class="button button-neutral button-xs join-item">
  <Icon icon={SmileCircle} size={4} />
</EmojiButton>
