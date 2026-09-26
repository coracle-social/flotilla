<script lang="ts">
  import type {TrustedEvent} from "@welshman/util"
  import EmojiButton from "@lib/components/EmojiButton.svelte"
  import SmileCircle from "@assets/icons/smile-circle.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import {publishReaction} from "@app/reactions"

  type Props = {
    url: string
    event: TrustedEvent
  }

  const {url, event}: Props = $props()

  const onEmoji = (emoji: string) => publishReaction(event, {content: emoji, tags: []}, {url})
</script>

<EmojiButton
  aria-label="Add a reaction"
  {onEmoji}
  class="button button-xs button-neutral join-item"
  tippyParams={{placement: "bottom-end"}}>
  <Icon icon={SmileCircle} size={4} />
</EmojiButton>
