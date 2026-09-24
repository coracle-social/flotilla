<script lang="ts">
  import * as nip19 from "nostr-tools/nip19"
  import type {TrustedEvent} from "@welshman/util"
  import {tagSpec, tagValue, toNostrURI} from "@welshman/util"
  import Code2 from "@assets/icons/code-2.svg?dataurl"
  import GalleryWide from "@assets/icons/gallery-wide.svg?dataurl"
  import ShareCircle from "@assets/icons/share-circle.svg?dataurl"
  import TrashBin2 from "@assets/icons/trash-bin-2.svg?dataurl"
  import Danger from "@assets/icons/danger.svg?dataurl"
  import Pin from "@assets/icons/pin.svg?dataurl"
  import NotesMinimalistic from "@assets/icons/notes-minimalistic.svg?dataurl"
  import VolumeLoud from "@assets/icons/volume-loud.svg?dataurl"
  import Button from "@lib/components/Button.svelte"
  import Icon from "@lib/components/Icon.svelte"
  import EventInfo from "@app/components/EventInfo.svelte"
  import Report from "@app/components/Report.svelte"
  import PinboardSelect from "@app/components/PinboardSelect.svelte"
  import EventAdminDeleteConfirm from "@app/components/EventAdminDeleteConfirm.svelte"
  import EventDeleteConfirm from "@app/components/EventDeleteConfirm.svelte"
  import ThreadCreate from "@app/components/ThreadCreate.svelte"
  import {roomPinLists, user} from "@app/core"
  import {deriveUserAdminDelete, deriveUserIsRoomAdmin} from "@app/rooms"
  import {shareEvent} from "@app/share"
  import {readAloud} from "@app/speech"
  import {pushModal} from "@app/modal"
  import {pushToast} from "@app/toast"

  type Props = {
    url: string
    event: TrustedEvent
    onClick: () => void
  }

  const {url, event, onClick}: Props = $props()

  const h = tagValue(tagSpec("h"), event.tags) ?? ""
  const pinIds = $roomPinLists.pins(url, h).$
  const userIsRoomAdmin = deriveUserIsRoomAdmin(url, h)
  const adminDelete = deriveUserAdminDelete(url, event)
  const isPinned = $derived($pinIds.includes(event.id))

  const share = () => {
    onClick()
    shareEvent(url, "Message", event)
  }

  const addToLibrary = () => {
    onClick()
    pushModal(PinboardSelect, {url, event})
  }

  const read = () => {
    onClick()
    readAloud(event)
  }

  const createThread = () => {
    onClick()
    pushModal(ThreadCreate, {
      url,
      h,
      initialValues: {content: toNostrURI(nip19.neventEncode({...event, relays: [url]}))},
    })
  }

  const report = () => {
    onClick()
    pushModal(Report, {url, event})
  }

  const showInfo = () => {
    onClick()
    pushModal(EventInfo, {url, event})
  }

  const showDelete = () => {
    onClick()
    pushModal(EventDeleteConfirm, {url, event})
  }

  const showAdminDelete = () => {
    onClick()
    pushModal(EventAdminDeleteConfirm, {url, noun: "Message", event})
  }

  const togglePin = async () => {
    onClick()

    if (!h) {
      return
    }

    // The optimistic write flips isPinned while the publish is in flight, so read it before it goes out.
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
</script>

<ul class="menu bg-surface whitespace-nowrap rounded-2xl p-2">
  <li>
    <Button onclick={showInfo}>
      <Icon size={4} icon={Code2} />
      Message Details
    </Button>
  </li>
  <li>
    <Button onclick={share}>
      <Icon size={4} icon={ShareCircle} />
      Share Message
    </Button>
  </li>
  <li>
    <Button onclick={addToLibrary}>
      <Icon size={4} icon={GalleryWide} />
      Add to Library
    </Button>
  </li>
  <li>
    <Button onclick={read}>
      <Icon size={4} icon={VolumeLoud} />
      Read Out Loud
    </Button>
  </li>
  {#if h}
    <li>
      <Button onclick={createThread}>
        <Icon size={4} icon={NotesMinimalistic} />
        Create a Thread
      </Button>
    </li>
  {/if}
  {#if h && $userIsRoomAdmin}
    <li>
      <Button onclick={togglePin}>
        <Icon size={4} icon={Pin} />
        {isPinned ? "Unpin Message" : "Pin Message"}
      </Button>
    </li>
  {/if}
  {#if event.pubkey === $user.pubkey}
    <li>
      <Button onclick={showDelete} class="text-error">
        <Icon size={4} icon={TrashBin2} />
        Delete Message
      </Button>
    </li>
  {:else}
    <li>
      <Button class="text-error" onclick={report}>
        <Icon size={4} icon={Danger} />
        Report Content
      </Button>
    </li>
    {#if $adminDelete}
      <li>
        <Button class="text-error" onclick={showAdminDelete}>
          <Icon size={4} icon={TrashBin2} />
          Delete Message
        </Button>
      </li>
    {/if}
  {/if}
</ul>
