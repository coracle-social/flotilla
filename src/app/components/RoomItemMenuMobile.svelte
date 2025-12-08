<script lang="ts">
  import type {NativeEmoji} from "emoji-picker-element/shared"
  import type {TrustedEvent} from "@welshman/util"
  import {pubkey} from "@welshman/app"
  import Bolt from "@assets/icons/bolt.svg?dataurl"
  import Reply from "@assets/icons/reply-2.svg?dataurl"
  import Code2 from "@assets/icons/code-2.svg?dataurl"
  import TrashBin2 from "@assets/icons/trash-bin-2.svg?dataurl"
  import SmileCircle from "@assets/icons/smile-circle.svg?dataurl"
  import MenuDots from "@assets/icons/menu-dots.svg?dataurl"
  import Button from "@lib/components/Button.svelte"
  import Link from "@lib/components/Link.svelte"
  import Icon from "@lib/components/Icon.svelte"
  import EmojiPicker from "@lib/components/EmojiPicker.svelte"
  import ZapButton from "@app/components/ZapButton.svelte"
  import EventInfo from "@app/components/EventInfo.svelte"
  import EventDeleteConfirm from "@app/components/EventDeleteConfirm.svelte"
  import {ENABLE_ZAPS} from "@app/core/state"
  import {publishReaction, canEnforceNip70} from "@app/core/commands"
  import {getRoomItemPath} from "@app/util/routes"
  import {pushModal} from "@app/util/modal"

  type Props = {
    url: string
    event: TrustedEvent
    reply: () => void
  }

  const {url, event, reply}: Props = $props()

  const path = getRoomItemPath(url, event)

  const shouldProtect = canEnforceNip70(url)

  const onEmoji = (async (event: TrustedEvent, url: string, emoji: NativeEmoji) => {
    history.back()
    publishReaction({
      event,
      relays: [url],
      content: emoji.unicode,
      protect: await shouldProtect,
    })
  }).bind(undefined, event, url)

  const showEmojiPicker = () => pushModal(EmojiPicker, {onClick: onEmoji}, {replaceState: true})

  const sendReply = () => {
    history.back()
    reply()
  }

  const showInfo = () => pushModal(EventInfo, {url, event}, {replaceState: true})

  const showDelete = () => pushModal(EventDeleteConfirm, {url, event})
</script>

<div class="flex flex-col gap-2">
  {#if event.pubkey === $pubkey}
    <Button class="btn btn-neutral text-error" onclick={showDelete}>
      <Icon size={4} icon={TrashBin2} />
      Delete Message
    </Button>
  {/if}
  <Button class="btn btn-neutral" onclick={showInfo}>
    <Icon size={4} icon={Code2} />
    Message Info
  </Button>
  {#if path}
    <Link class="btn btn-neutral" href={path}>
      <Icon size={4} icon={MenuDots} />
      View Details
    </Link>
  {/if}
  {#if ENABLE_ZAPS}
    <ZapButton replaceState {url} {event} class="btn btn-neutral w-full">
      <Icon size={4} icon={Bolt} />
      Send Zap
    </ZapButton>
  {/if}
  <Button class="btn btn-neutral w-full" onclick={sendReply}>
    <Icon size={4} icon={Reply} />
    Send Reply
  </Button>
  <Button class="btn btn-neutral w-full" onclick={showEmojiPicker}>
    <Icon size={4} icon={SmileCircle} />
    Send Reaction
  </Button>
</div>
