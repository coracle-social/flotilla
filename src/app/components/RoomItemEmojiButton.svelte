<script lang="ts">
  import type {NativeEmoji} from "emoji-picker-element/shared"
  import type {TrustedEvent} from "@welshman/util"
  import {tagSpec, tagValue} from "@welshman/util"
  import EmojiButton from "@lib/components/EmojiButton.svelte"
  import SmileCircle from "@assets/icons/smile-circle.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import {reactions, relays} from "@app/core"

  type Props = {
    url: string
    event: TrustedEvent
  }

  const {url, event}: Props = $props()

  const shouldProtect = $relays.hasNip(url, 70)

  const onEmoji = async (emoji: NativeEmoji) => {
    const protect = await shouldProtect
    const room = tagValue(tagSpec("h"), event.tags)

    const command = await $reactions.react(event, emoji.unicode, writer => {
      writer.setProtected(protect)

      if (room) {
        writer.setRoom(url, room)
      }
    })

    return command.publishToRelays([url])
  }
</script>

<EmojiButton
  aria-label="Add a reaction"
  {onEmoji}
  class="button button-xs button-neutral join-item"
  tippyParams={{placement: "bottom-end"}}>
  <Icon icon={SmileCircle} size={4} />
</EmojiButton>
