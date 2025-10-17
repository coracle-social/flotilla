<script lang="ts">
  import type {NativeEmoji} from "emoji-picker-element/shared"
  import type {TrustedEvent} from "@welshman/util"
  import {sendWrapped} from "@welshman/app"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import EmojiPicker from "@lib/components/EmojiPicker.svelte"
  import EventInfo from "@app/components/EventInfo.svelte"
  import {makeReaction} from "@app/core/commands"
  import {pushModal} from "@app/util/modal"
  import {clip} from "@app/util/toast"
  import SmileCircle from "@assets/icons/smile-circle.svg?dataurl"
  import Reply from "@assets/icons/reply-2.svg?dataurl"
  import Copy from "@assets/icons/copy.svg?dataurl"
  import Code2 from "@assets/icons/code-2.svg?dataurl"

  type Props = {
    pubkeys: string[]
    event: TrustedEvent
    reply: () => void
  }

  const {event, pubkeys, reply}: Props = $props()

  const onEmoji = ((event: TrustedEvent, pubkeys: string[], emoji: NativeEmoji) => {
    history.back()
    sendWrapped({
      event: makeReaction({event, content: emoji.unicode, protect: false}),
      recipients: pubkeys,
    })
  }).bind(undefined, event, pubkeys)

  const showEmojiPicker = () => pushModal(EmojiPicker, {onClick: onEmoji}, {replaceState: true})

  const sendReply = () => {
    history.back()
    reply()
  }

  const copyText = () => {
    history.back()
    clip(event.content)
  }

  const showInfo = () => pushModal(EventInfo, {event}, {replaceState: true})
</script>

<div class="col-2">
  <Button class="btn btn-primary w-full" onclick={showEmojiPicker}>
    <Icon size={4} icon={SmileCircle} />
    Send Reaction
  </Button>
  <Button class="btn btn-neutral w-full" onclick={sendReply}>
    <Icon size={4} icon={Reply} />
    Send Reply
  </Button>
  <Button class="btn btn-neutral w-full" onclick={copyText}>
    <Icon size={4} icon={Copy} />
    Copy Text
  </Button>
  <Button class="btn btn-neutral" onclick={showInfo}>
    <Icon size={4} icon={Code2} />
    Message Details
  </Button>
</div>
