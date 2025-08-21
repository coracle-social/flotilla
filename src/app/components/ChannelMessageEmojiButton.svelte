<script lang="ts">
  import type {NativeEmoji} from "emoji-picker-element/shared"
  import EmojiButton from "@lib/components/EmojiButton.svelte"
  import Icon from "@lib/components/Icon.svelte"
  import {publishReaction, canEnforceNip70} from "@app/core/commands"

  const {url, event} = $props()

  const shouldProtect = canEnforceNip70(url)

  const onEmoji = async (emoji: NativeEmoji) =>
    publishReaction({
      event,
      relays: [url],
      content: emoji.unicode,
      protect: await shouldProtect,
    })
</script>

<EmojiButton {onEmoji} class="btn join-item btn-xs">
  <Icon icon="smile-circle" size={4} />
</EmojiButton>
