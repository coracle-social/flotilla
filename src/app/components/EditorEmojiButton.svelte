<script lang="ts">
  import type {Editor} from "@welshman/editor"
  import SmileCircle from "@assets/icons/smile-circle.svg?dataurl"
  import {escapeHtml} from "@lib/html"
  import Icon from "@lib/components/Icon.svelte"
  import EmojiButton from "@lib/components/EmojiButton.svelte"

  type Props = {
    editor: Promise<Editor>
    class?: string
    disabled?: boolean
  }

  const {editor, class: className, disabled = false}: Props = $props()

  const onEmoji = async (emoji: string) => {
    const ed = await editor

    ed.chain().focus().insertContent(escapeHtml(emoji)).run()
  }
</script>

<EmojiButton
  aria-label="Add emoji"
  data-tip="Emoji"
  {onEmoji}
  allowKaomoji
  {disabled}
  class={className}>
  <Icon icon={SmileCircle} />
</EmojiButton>
