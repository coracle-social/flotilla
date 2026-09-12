<script lang="ts">
  import type {NativeEmoji} from "emoji-picker-element/shared"
  import type {TrustedEvent} from "@welshman/util"
  import SmileCircle from "@assets/icons/smile-circle.svg?dataurl"
  import Pen from "@assets/icons/pen.svg?dataurl"
  import Reply from "@assets/icons/reply-2.svg?dataurl"
  import Copy from "@assets/icons/copy.svg?dataurl"
  import Code2 from "@assets/icons/code-2.svg?dataurl"
  import AltArrowDown from "@assets/icons/alt-arrow-down.svg?dataurl"
  import AltArrowUp from "@assets/icons/alt-arrow-up.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Modal from "@lib/components/Modal.svelte"
  import ModalBody from "@lib/components/ModalBody.svelte"
  import {slideAndFade} from "@lib/transition"
  import Button from "@lib/components/Button.svelte"
  import EmojiPicker from "@lib/components/EmojiPicker.svelte"
  import EventInfo from "@app/components/EventInfo.svelte"
  import {reactions, wraps} from "@app/core"
  import {pushModal} from "@app/modal"
  import {clip} from "@app/toast"

  type Props = {
    pubkeys: string[]
    event: TrustedEvent
    reply: () => void
    edit?: () => void
  }

  const {event, pubkeys, reply, edit}: Props = $props()

  const tile = "button h-auto flex-col gap-1.5 py-4 text-xs"

  const onEmoji = async (emoji: NativeEmoji) => {
    history.back()

    const reaction = await $reactions.react(event, emoji.unicode)

    return $wraps.publish({event: reaction.event, recipients: pubkeys, pow: 16})
  }

  const showEmojiPicker = () => pushModal(EmojiPicker, {onClick: onEmoji}, {replaceState: true})

  const sendReply = () => {
    history.back()
    reply()
  }

  const sendEdit = () => {
    history.back()
    edit?.()
  }

  const copyText = () => {
    history.back()
    clip(event.content)
  }

  const showInfo = () => pushModal(EventInfo, {event}, {replaceState: true})

  const toggleMore = () => {
    showMore = !showMore
  }

  let showMore = $state(false)
</script>

<Modal label="Message actions">
  <ModalBody>
    <div class="grid grid-cols-2 gap-2">
      <Button class="{tile} button-outline button-primary" onclick={showEmojiPicker}>
        <Icon size={6} icon={SmileCircle} />
        React
      </Button>
      <Button class="{tile} button-neutral" onclick={sendReply}>
        <Icon size={6} icon={Reply} />
        Reply
      </Button>
    </div>
    <div class="flex flex-col">
      <Button class="button button-neutral w-full" onclick={toggleMore}>
        <Icon size={4} icon={showMore ? AltArrowUp : AltArrowDown} />
        {showMore ? "Fewer Options" : "More Options"}
      </Button>
      {#if showMore}
        <div transition:slideAndFade class="flex flex-col gap-2 pt-2">
          {#if edit}
            <Button class="button button-neutral w-full" onclick={sendEdit}>
              <Icon size={4} icon={Pen} />
              Edit Message
            </Button>
          {/if}
          <Button class="button button-neutral w-full" onclick={copyText}>
            <Icon size={4} icon={Copy} />
            Copy Text
          </Button>
          <Button class="button button-neutral w-full" onclick={showInfo}>
            <Icon size={4} icon={Code2} />
            Message Info
          </Button>
        </div>
      {/if}
    </div>
  </ModalBody>
</Modal>
