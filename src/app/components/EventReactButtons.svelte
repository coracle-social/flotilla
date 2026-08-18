<script lang="ts">
  import type {NativeEmoji} from "emoji-picker-element/shared"
  import type {TrustedEvent} from "@welshman/util"
  import {tagSpec, tagValue} from "@welshman/util"
  import Bolt from "@assets/icons/bolt.svg?dataurl"
  import SmileCircle from "@assets/icons/smile-circle.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import EmojiButton from "@lib/components/EmojiButton.svelte"
  import ZapButton from "@app/components/ZapButton.svelte"
  import {publishReaction} from "@app/reactions"
  import {ENABLE_ZAPS} from "@app/env"

  type Props = {
    url: string
    event: TrustedEvent
    hideZap?: boolean
    class?: string
  }

  const {url, event, hideZap, class: className = ""}: Props = $props()

  const h = tagValue(tagSpec("h"), event.tags)

  const onEmoji = (emoji: NativeEmoji) =>
    publishReaction(event, {content: emoji.unicode, tags: []}, {url, h})
</script>

{#if ENABLE_ZAPS && !hideZap}
  <ZapButton {url} {event} aria-label="Send a zap" data-tip="Zap" class={className}>
    <Icon icon={Bolt} size={4} />
  </ZapButton>
{/if}
<EmojiButton {onEmoji} aria-label="Add a reaction" data-tip="React" class={className}>
  <Icon icon={SmileCircle} size={4} />
</EmojiButton>
