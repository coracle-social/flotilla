<script lang="ts">
  import type {NativeEmoji} from "emoji-picker-element/shared"
  import type {TrustedEvent} from "@welshman/util"
  import {sendWrapped} from "@welshman/app"
  import SmileCircle from "@assets/icons/smile-circle.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import EmojiButton from "@lib/components/EmojiButton.svelte"
  import {makeReaction} from "@app/core/commands"

  interface Props {
    event: TrustedEvent
    pubkeys: string[]
  }

  const {event, pubkeys}: Props = $props()

  const onEmoji = (emoji: NativeEmoji) =>
    sendWrapped({template: makeReaction({event, content: emoji.unicode, protect: false}), pubkeys})
</script>

<EmojiButton {onEmoji} class="btn join-item btn-xs">
  <Icon icon={SmileCircle} size={4} />
</EmojiButton>
