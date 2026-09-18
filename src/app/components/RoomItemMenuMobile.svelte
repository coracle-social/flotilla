<script lang="ts">
  import type {NativeEmoji} from "emoji-picker-element/shared"
  import type {TrustedEvent} from "@welshman/util"
  import * as nip19 from "nostr-tools/nip19"
  import {getIdOrAddress, tagSpec, tagValue, toNostrURI} from "@welshman/util"
  import Bolt from "@assets/icons/bolt.svg?dataurl"
  import Pen from "@assets/icons/pen.svg?dataurl"
  import Reply from "@assets/icons/reply-2.svg?dataurl"
  import ShareCircle from "@assets/icons/share-circle.svg?dataurl"
  import Code2 from "@assets/icons/code-2.svg?dataurl"
  import TrashBin2 from "@assets/icons/trash-bin-2.svg?dataurl"
  import SmileCircle from "@assets/icons/smile-circle.svg?dataurl"
  import MenuDots from "@assets/icons/menu-dots.svg?dataurl"
  import AltArrowDown from "@assets/icons/alt-arrow-down.svg?dataurl"
  import AltArrowUp from "@assets/icons/alt-arrow-up.svg?dataurl"
  import Pin from "@assets/icons/pin.svg?dataurl"
  import NotesMinimalistic from "@assets/icons/notes-minimalistic.svg?dataurl"
  import VolumeLoud from "@assets/icons/volume-loud.svg?dataurl"
  import {slideAndFade} from "@lib/transition"
  import Button from "@lib/components/Button.svelte"
  import Link from "@lib/components/Link.svelte"
  import Icon from "@lib/components/Icon.svelte"
  import Modal from "@lib/components/Modal.svelte"
  import ModalBody from "@lib/components/ModalBody.svelte"
  import EmojiPicker from "@lib/components/EmojiPicker.svelte"
  import ZapButton from "@app/components/ZapButton.svelte"
  import EventInfo from "@app/components/EventInfo.svelte"
  import EventDeleteConfirm from "@app/components/EventDeleteConfirm.svelte"
  import ThreadCreate from "@app/components/ThreadCreate.svelte"
  import {reactions, relays, roomPinLists, user} from "@app/core"
  import {deriveUserIsRoomAdmin} from "@app/rooms"
  import {ENABLE_ZAPS} from "@app/env"
  import {makeContentPath} from "@app/routes"
  import {shareEvent} from "@app/share"
  import {readAloud} from "@app/speech"
  import {pushModal} from "@app/modal"
  import {pushToast} from "@app/toast"

  type Props = {
    url: string
    event: TrustedEvent
    reply: () => void
    edit?: () => void
  }

  const {url, event, reply, edit}: Props = $props()

  const h = tagValue(tagSpec("h"), event.tags) ?? ""
  const path = makeContentPath(url, event.kind, getIdOrAddress(event))
  const pinIds = $roomPinLists.pins(url, h).$
  const userIsRoomAdmin = deriveUserIsRoomAdmin(url, h)
  const isPinned = $derived($pinIds.includes(event.id))
  const tile = "button h-auto flex-col gap-1.5 py-4 text-xs"

  const onEmoji = async (emoji: NativeEmoji) => {
    history.back()

    const protect = await $relays.hasNip(url, 70)
    const command = await $reactions.react(event, emoji.unicode, w => w.setProtected(protect))

    command.publishToRelays([url])
  }

  const showEmojiPicker = () => pushModal(EmojiPicker, {onClick: onEmoji}, {replaceState: true})

  const createThread = () =>
    pushModal(
      ThreadCreate,
      {
        url,
        h,
        initialValues: {content: toNostrURI(nip19.neventEncode({...event, relays: [url]}))},
      },
      {replaceState: true},
    )

  const sendReply = () => {
    history.back()
    reply()
  }

  const sendEdit = () => {
    history.back()
    edit?.()
  }

  const share = () => {
    history.back()
    shareEvent(url, "Message", event)
  }

  const read = () => {
    history.back()
    readAloud(event)
  }

  const showInfo = () => pushModal(EventInfo, {url, event}, {replaceState: true})

  const showDelete = () => pushModal(EventDeleteConfirm, {url, event})

  const toggleMore = () => {
    showMore = !showMore
  }

  const togglePin = async () => {
    if (!h) return

    history.back()

    // The optimistic write flips isPinned while the publish is in flight, so what this did is read
    // before it goes out rather than after.
    const wasPinned = isPinned
    const pins = wasPinned ? $pinIds.filter(pin => pin !== event.id) : [...$pinIds, event.id]
    const command = await $roomPinLists.setPins(url, h, pins)
    const error = await command.publishToRelays([url]).waitForError()

    if (error) {
      pushToast({theme: "error", message: error})
    } else {
      pushToast({message: wasPinned ? "Message unpinned" : "Message pinned"})
    }
  }

  let showMore = $state(false)
</script>

<Modal label="Message actions">
  <ModalBody>
    <div class="grid gap-2 {ENABLE_ZAPS ? 'grid-cols-3' : 'grid-cols-2'}">
      {#if ENABLE_ZAPS}
        <ZapButton replaceState {url} {event} class="{tile} button-outline button-secondary">
          <Icon size={6} icon={Bolt} />
          Zap
        </ZapButton>
      {/if}
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
          <Button class="button button-neutral w-full" onclick={share}>
            <Icon size={4} icon={ShareCircle} />
            Share
          </Button>
          <Button class="button button-neutral w-full" onclick={read}>
            <Icon size={4} icon={VolumeLoud} />
            Read Out Loud
          </Button>
          {#if h}
            <Button class="button button-neutral w-full" onclick={createThread}>
              <Icon size={4} icon={NotesMinimalistic} />
              Create a Thread
            </Button>
          {/if}
          {#if h && $userIsRoomAdmin}
            <Button class="button button-neutral w-full" onclick={togglePin}>
              <Icon size={4} icon={Pin} />
              {isPinned ? "Unpin Message" : "Pin Message"}
            </Button>
          {/if}
          {#if path}
            <Link class="button button-neutral w-full" href={path}>
              <Icon size={4} icon={MenuDots} />
              View Details
            </Link>
          {/if}
          <Button class="button button-neutral w-full" onclick={showInfo}>
            <Icon size={4} icon={Code2} />
            Message Info
          </Button>
          {#if event.pubkey === $user.pubkey}
            <Button class="button button-neutral w-full text-error" onclick={showDelete}>
              <Icon size={4} icon={TrashBin2} />
              Delete Message
            </Button>
          {/if}
        </div>
      {/if}
    </div>
  </ModalBody>
</Modal>
