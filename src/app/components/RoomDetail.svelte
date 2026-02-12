<script lang="ts">
  import {goto} from "$app/navigation"
  import type {RoomMeta} from "@welshman/util"
  import {displayRelayUrl, makeRoomMeta} from "@welshman/util"
  import type {Thunk} from "@welshman/app"
  import {deleteRoom, waitForThunkError, repository, joinRoom, leaveRoom} from "@welshman/app"
  import Pen from "@assets/icons/pen.svg?dataurl"
  import TrashBin2 from "@assets/icons/trash-bin-2.svg?dataurl"
  import Login3 from "@assets/icons/login-3.svg?dataurl"
  import MenuDots from "@assets/icons/menu-dots.svg?dataurl"
  import ClockCircle from "@assets/icons/clock-circle.svg?dataurl"
  import AltArrowLeft from "@assets/icons/alt-arrow-left.svg?dataurl"
  import EyeClosed from "@assets/icons/eye-closed.svg?dataurl"
  import Eye from "@assets/icons/eye.svg?dataurl"
  import MinusCircle from "@assets/icons/minus-circle.svg?dataurl"
  import Lock from "@assets/icons/lock.svg?dataurl"
  import Microphone from "@assets/icons/microphone.svg?dataurl"
  import Bookmark from "@assets/icons/bookmark.svg?dataurl"
  import VolumeLoud from "@assets/icons/volume-loud.svg?dataurl"
  import {fly} from "@lib/transition"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import Popover from "@lib/components/Popover.svelte"
  import Confirm from "@lib/components/Confirm.svelte"
  import Modal from "@lib/components/Modal.svelte"
  import ModalBody from "@lib/components/ModalBody.svelte"
  import ModalFooter from "@lib/components/ModalFooter.svelte"
  import ProfileCircles from "@app/components/ProfileCircles.svelte"
  import RoomMembers from "@app/components/RoomMembers.svelte"
  import RoomEdit from "@app/components/RoomEdit.svelte"
  import RoomName from "@app/components/RoomName.svelte"
  import RoomImage from "@app/components/RoomImage.svelte"
  import {
    deriveRoom,
    deriveRoomMembers,
    deriveUserIsRoomAdmin,
    deriveUserRoomMembershipStatus,
    deriveUserRooms,
    deriveShouldNotify,
    MembershipStatus,
  } from "@app/core/state"
  import {
    addRoomMembership,
    removeRoomMembership,
    toggleRoomNotifications,
  } from "@app/core/commands"
  import {makeSpacePath} from "@app/util/routes"
  import {pushModal} from "@app/util/modal"
  import {pushToast} from "@app/util/toast"

  type Props = {
    url: string
    h: string
  }

  const {url, h}: Props = $props()

  const room = deriveRoom(url, h)
  const members = deriveRoomMembers(url, h)
  const userIsAdmin = deriveUserIsRoomAdmin(url, h)
  const membershipStatus = deriveUserRoomMembershipStatus(url, h)
  const userRooms = deriveUserRooms(url)

  const isFavorite = $derived($userRooms.includes(h))
  const shouldNotify = deriveShouldNotify(url, h)

  const back = () => history.back()

  const toggleMenu = () => {
    showMenu = !showMenu
  }

  const closeMenu = () => {
    showMenu = false
  }

  const startEdit = () => pushModal(RoomEdit, {url, h})

  const handleLoading = async (f: (url: string, room: RoomMeta) => Thunk) => {
    loading = true

    try {
      const message = await waitForThunkError(f(url, makeRoomMeta({h})))

      if (message && !message.startsWith("duplicate:")) {
        pushToast({theme: "error", message})
      }
    } finally {
      loading = false
    }
  }

  const join = () => handleLoading(joinRoom)

  const leave = () => handleLoading(leaveRoom)

  const showMembers = () => pushModal(RoomMembers, {url, h})

  const toggleFavorite = () => {
    if (isFavorite) {
      removeRoomMembership(url, h)
    } else {
      addRoomMembership(url, h)
    }
  }

  const toggleShouldNotify = () => {
    toggleRoomNotifications(url, h)
  }

  const startDelete = () =>
    pushModal(Confirm, {
      title: "Are you sure you want to delete this room?",
      message:
        "This room will no longer be accessible to space members, and all messages posted to it will be deleted.",
      confirm: async () => {
        const thunk = deleteRoom(url, $room)
        const message = await waitForThunkError(thunk)

        if (message) {
          repository.removeEvent(thunk.event.id)
          pushToast({theme: "error", message})
        } else {
          goto(makeSpacePath(url))
        }
      },
    })

  let loading = $state(false)
  let showMenu = $state(false)
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
      <div class="relative">
        <Button class="btn btn-circle btn-ghost btn-sm" onclick={toggleMenu}>
          <Icon icon={MenuDots} />
        </Button>
        {#if showMenu}
          <Popover hideOnClick onClose={closeMenu}>
            <ul
              transition:fly
              class="bg-alt menu absolute right-0 z-popover w-48 gap-1 rounded-box p-2 shadow-md">
              {#if $userIsAdmin}
                <li>
                  <Button class="text-error" onclick={startDelete}>
                    <Icon icon={TrashBin2} />
                    Delete Room
                  </Button>
                </li>
                <li>
                  <Button onclick={startEdit}>
                    <Icon icon={Pen} />
                    Edit Room
                  </Button>
                </li>
              {:else if $membershipStatus === MembershipStatus.Initial}
                <li>
                  <Button disabled={loading} onclick={join}>
                    {#if loading}
                      <span class="loading loading-spinner loading-sm"></span>
                    {:else}
                      <Icon icon={Login3} />
                    {/if}
                    Join member list
                  </Button>
                </li>
              {:else if $membershipStatus === MembershipStatus.Pending}
                <li>
                  <Button>
                    <Icon icon={ClockCircle} />
                    Membership pending
                  </Button>
                </li>
              {:else}
                <li>
                  <Button disabled={loading} onclick={leave}>
                    {#if loading}
                      <span class="loading loading-spinner loading-sm"></span>
                    {:else}
                      <Icon icon={Login3} />
                    {/if}
                    Leave member list
                  </Button>
                </li>
              {/if}
            </ul>
          </Popover>
        {/if}
      </div>
    </div>
    {#if $room?.about}
      <p>{$room.about}</p>
    {/if}
    <div class="flex flex-col gap-2 card2 card2-sm bg-alt">
      <strong class="text-lg">Room Permissions</strong>
      <div class="flex gap-2 flex-wrap">
        {#if $room?.isRestricted}
          <Button
            class="btn btn-neutral btn-xs rounded-full tooltip flex gap-2 items-center"
            data-tip="Only members can send messages.">
            <Icon size={4} icon={Microphone} /> Restricted
          </Button>
        {/if}
        {#if $room?.isPrivate}
          <Button
            class="btn btn-neutral btn-xs rounded-full tooltip flex gap-2 items-center"
            data-tip="Only members can view messages.">
            <Icon size={4} icon={Lock} /> Private
          </Button>
        {/if}
        {#if $room?.isHidden}
          <Button
            class="btn btn-neutral btn-xs rounded-full tooltip flex gap-2 items-center"
            data-tip="This room is not visible to non-members.">
            <Icon size={4} icon={EyeClosed} /> Hidden
          </Button>
        {/if}
        {#if $room?.isClosed}
          <Button
            class="btn btn-neutral btn-xs rounded-full tooltip flex gap-2 items-center"
            data-tip="Requests to join this room will be ignored.">
            <Icon size={4} icon={MinusCircle} /> Closed
          </Button>
        {/if}
        {#if !$room?.isRestricted && !$room?.isPrivate && !$room?.isHidden && !$room?.isClosed}
          <Button
            class="btn btn-neutral btn-xs rounded-full tooltip flex gap-2 items-center"
            data-tip="This room has no additional access controls.">
            <Icon size={4} icon={Eye} /> Public
          </Button>
        {/if}
      </div>
    </div>
    {#if $members.length > 0}
      <div class="card2 card2-sm bg-alt flex items-center justify-between gap-4">
        <div class="flex items-center gap-4">
          <span>Members:</span>
          <ProfileCircles pubkeys={$members} />
        </div>
        <Button class="btn btn-neutral btn-sm" onclick={showMembers}>View All</Button>
      </div>
    {/if}
    <div class="card2 card2-sm bg-alt col-4">
      <strong class="text-lg">Room Settings</strong>
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <Icon icon={VolumeLoud} />
          <span>Notifications</span>
        </div>
        <input
          type="checkbox"
          class="toggle toggle-primary"
          checked={$shouldNotify}
          onchange={toggleShouldNotify} />
      </div>
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <Icon icon={Bookmark} />
          <span>Favorite</span>
        </div>
        <input
          type="checkbox"
          class="toggle toggle-primary"
          checked={isFavorite}
          onchange={toggleFavorite} />
      </div>
    </div>
  </ModalBody>
  <ModalFooter>
    <Button class="btn btn-link" onclick={back}>
      <Icon icon={AltArrowLeft} />
      Go back
    </Button>
  </ModalFooter>
</Modal>
