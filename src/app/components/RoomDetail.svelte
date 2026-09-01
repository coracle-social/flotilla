<script lang="ts">
  import {displayRelayUrl} from "@welshman/util"
  import {publish} from "@welshman/app"
  import AltArrowLeft from "@assets/icons/alt-arrow-left.svg?dataurl"
  import LinkRound from "@assets/icons/link-round.svg?dataurl"
  import EyeClosed from "@assets/icons/eye-closed.svg?dataurl"
  import Eye from "@assets/icons/eye.svg?dataurl"
  import MinusCircle from "@assets/icons/minus-circle.svg?dataurl"
  import Lock from "@assets/icons/lock.svg?dataurl"
  import Microphone from "@assets/icons/microphone.svg?dataurl"
  import Bookmark from "@assets/icons/bookmark.svg?dataurl"
  import Bell from "@assets/icons/bell.svg?dataurl"
  import BellOff from "@assets/icons/bell-off.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import MenuButton from "@lib/components/MenuButton.svelte"
  import Tooltip from "@lib/components/Tooltip.svelte"
  import Modal from "@lib/components/Modal.svelte"
  import ModalBody from "@lib/components/ModalBody.svelte"
  import ModalFooter from "@lib/components/ModalFooter.svelte"
  import ProfileCircles from "@app/components/ProfileCircles.svelte"
  import RoomMembers from "@app/components/RoomMembers.svelte"
  import RoomDetailMenu from "@app/components/RoomDetailMenu.svelte"
  import RoomInvite from "@app/components/RoomInvite.svelte"
  import RoomName from "@app/components/RoomName.svelte"
  import RoomImage from "@app/components/RoomImage.svelte"
  import {roomLists, rooms} from "@app/core"
  import {deriveRoomMembers, deriveUserIsRoomAdmin, deriveUserRooms} from "@app/rooms"
  import {
    deriveIsMuted,
    deriveShouldNotify,
    toggleRoomMuted,
    toggleRoomNotifications,
  } from "@app/settings"
  import {pushModal} from "@app/modal"

  type Props = {
    url: string
    h: string
  }

  const {url, h}: Props = $props()

  const room = $rooms.forRoom(url, h)
  const members = deriveRoomMembers(url, h)
  const userRooms = deriveUserRooms(url)
  const userIsAdmin = deriveUserIsRoomAdmin(url, h)

  const meta = $derived($room?.meta)
  const isFavorite = $derived($userRooms.includes(h))
  const shouldNotify = deriveShouldNotify(url, h)
  const isMuted = deriveIsMuted(url, h)

  const back = () => history.back()

  const showMembers = () => pushModal(RoomMembers, {url, h})

  const createInvite = () => pushModal(RoomInvite, {url, h})

  const toggleFavorite = () => {
    if (isFavorite) {
      $roomLists.removeRoom(h, url).then(publish)
    } else {
      $roomLists.addRoom(h, url).then(publish)
    }
  }

  const toggleShouldNotify = () => {
    toggleRoomNotifications(url, h)
  }

  const toggleMuted = () => {
    toggleRoomMuted(url, h)
  }
</script>

<Modal>
  <ModalBody>
    <div class="flex justify-between">
      <div class="flex gap-3">
        <div class="pt-0.5">
          <RoomImage {url} {h} size={8} />
        </div>
        <div class="flex min-w-0 flex-col">
          <RoomName {url} {h} class="text-2xl" />
          <span class="text-primary">{displayRelayUrl(url)}</span>
        </div>
      </div>
      <MenuButton component={RoomDetailMenu} componentProps={{url, h}} />
    </div>
    {#if meta?.about()}
      <p>{meta.about()}</p>
    {/if}
    <div class="flex flex-col gap-2 card card-sm">
      <strong class="text-lg">Room Permissions</strong>
      <div class="flex gap-2 flex-wrap">
        {#if meta?.isRestricted()}
          <Tooltip content="Only members can send messages.">
            <Button class="button button-neutral button-xs button-pill flex gap-2 items-center">
              <Icon size={4} icon={Microphone} /> Restricted
            </Button>
          </Tooltip>
        {/if}
        {#if meta?.isPrivate()}
          <Tooltip content="Only members can view messages.">
            <Button class="button button-neutral button-xs button-pill flex gap-2 items-center">
              <Icon size={4} icon={Lock} /> Private
            </Button>
          </Tooltip>
        {/if}
        {#if meta?.isHidden()}
          <Tooltip content="This room is not visible to non-members.">
            <Button class="button button-neutral button-xs button-pill flex gap-2 items-center">
              <Icon size={4} icon={EyeClosed} /> Hidden
            </Button>
          </Tooltip>
        {/if}
        {#if meta?.isClosed()}
          <Tooltip content="Requests to join this room will be ignored.">
            <Button class="button button-neutral button-xs button-pill flex gap-2 items-center">
              <Icon size={4} icon={MinusCircle} /> Closed
            </Button>
          </Tooltip>
        {/if}
        {#if !meta?.isRestricted() && !meta?.isPrivate() && !meta?.isHidden() && !meta?.isClosed()}
          <Tooltip content="This room has no additional access controls.">
            <Button class="button button-neutral button-xs button-pill flex gap-2 items-center">
              <Icon size={4} icon={Eye} /> Public
            </Button>
          </Tooltip>
        {/if}
      </div>
    </div>
    <div class="card card-sm flex flex-col gap-3">
      {#if $members.length > 0}
        <div class="flex items-center justify-between gap-4">
          <div class="flex min-w-0 items-center gap-4">
            <span class="shrink-0">Members:</span>
            <ProfileCircles pubkeys={$members} class="min-w-0 overflow-hidden" />
          </div>
          <Button class="button button-neutral button-sm shrink-0" onclick={showMembers}
            >View All</Button>
        </div>
      {:else}
        <span class="opacity-75">No member list is available for this room.</span>
      {/if}
      {#if $userIsAdmin}
        <Button class="button button-neutral" onclick={createInvite}>
          <Icon icon={LinkRound} />
          Create invite
        </Button>
      {/if}
    </div>
    <div class="card card-sm flex flex-col gap-4">
      <strong class="text-lg">Room Settings</strong>
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <Icon icon={Bookmark} />
          <span>Favorite</span>
        </div>
        <input type="checkbox" class="toggle" checked={isFavorite} onchange={toggleFavorite} />
      </div>
      <div class="flex items-center justify-between gap-4">
        <div class="flex min-w-0 items-center gap-2">
          <Icon icon={BellOff} />
          <div class="flex min-w-0 flex-col">
            <span>Mute</span>
            <span class="text-sm opacity-75">Hide alerts and unread badges for this room</span>
          </div>
        </div>
        <input type="checkbox" class="toggle" checked={$isMuted} onchange={toggleMuted} />
      </div>
      <div class="flex items-center justify-between" class:opacity-50={$isMuted}>
        <div class="flex items-center gap-2">
          <Icon icon={Bell} />
          <span>Notifications</span>
        </div>
        <input
          type="checkbox"
          class="toggle"
          checked={$shouldNotify}
          disabled={$isMuted}
          onchange={toggleShouldNotify} />
      </div>
    </div>
  </ModalBody>
  <ModalFooter>
    <Button class="button button-link" onclick={back}>
      <Icon icon={AltArrowLeft} />
      Go back
    </Button>
  </ModalFooter>
</Modal>
