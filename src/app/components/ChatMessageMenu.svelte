<script lang="ts">
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import ChatMessageEmojiButton from "@app/components/ChatMessageEmojiButton.svelte"
  import EventInfo from "@app/components/EventInfo.svelte"
  import {pushModal} from "@app/modal"
  import Pen from "@assets/icons/pen.svg?dataurl"
  import Reply from "@assets/icons/reply-2.svg?dataurl"
  import Code2 from "@assets/icons/code-2.svg?dataurl"

  const {event, pubkeys, tippy, replyTo, edit} = $props()

  const reply = () => replyTo(event)
  const onEdit = () => edit?.()

  const showInfo = () => {
    tippy.hide()
    pushModal(EventInfo, {event})
  }
</script>

<div class="join text-xs">
  <ChatMessageEmojiButton {event} {pubkeys} />
  {#if replyTo}
    <Button aria-label="Reply" class="button button-neutral button-xs join-item" onclick={reply}>
      <Icon size={4} icon={Reply} />
    </Button>
  {/if}
  {#if edit}
    <Button aria-label="Edit" class="button button-neutral button-xs join-item" onclick={onEdit}>
      <Icon size={4} icon={Pen} />
    </Button>
  {/if}
  <Button
    aria-label="Message info"
    class="button button-neutral button-xs join-item"
    onclick={showInfo}>
    <Icon size={4} icon={Code2} />
  </Button>
</div>
