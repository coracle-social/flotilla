<script lang="ts">
  import {goto} from "$app/navigation"
  import type {RoomMeta} from "@welshman/util"
  import {displayRelayUrl, makeRoomMeta} from "@welshman/util"
  import type {Thunk} from "@welshman/app"
  import {deleteRoom, waitForThunkError, repository, joinRoom, leaveRoom} from "@welshman/app"
  import Pen from "@assets/icons/pen.svg?dataurl"
  import TrashBin2 from "@assets/icons/trash-bin-2.svg?dataurl"
  import Login3 from "@assets/icons/login-3.svg?dataurl"
  import ClockCircle from "@assets/icons/clock-circle.svg?dataurl"
  import AltArrowLeft from "@assets/icons/alt-arrow-left.svg?dataurl"
  import EyeClosed from "@assets/icons/eye-closed.svg?dataurl"
  import MinusCircle from "@assets/icons/minus-circle.svg?dataurl"
  import Lock from "@assets/icons/lock.svg?dataurl"
  import Microphone from "@assets/icons/microphone.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import Confirm from "@lib/components/Confirm.svelte"
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
    MembershipStatus,
  } from "@app/core/state"
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

  const back = () => history.back()

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
</script>

<div class="flex flex-col gap-3">
  <div class="flex justify-between">
    <div class="flex gap-3">
      <RoomImage {url} {h} size={8} />
      <div class="flex min-w-0 flex-col">
        <RoomName {url} {h} class="text-2xl" />
        <span class="text-primary">{displayRelayUrl(url)}</span>
      </div>
    </div>
    <div class="grid grid-cols-2 gap-2">
      {#if $room?.isRestricted}
        <Button
          class="btn btn-neutral btn-sm tooltip tooltip-left"
          data-tip="Only members can send messages.">
          <Icon size={4} icon={Microphone} />
        </Button>
      {/if}
      {#if $room?.isPrivate}
        <Button
          class="btn btn-neutral btn-sm tooltip tooltip-left"
          data-tip="Only members can view messages.">
          <Icon size={4} icon={Lock} />
        </Button>
      {/if}
      {#if $room?.isHidden}
        <Button
          class="btn btn-neutral btn-sm tooltip tooltip-left"
          data-tip="This room is not visible to non-members.">
          <Icon size={4} icon={EyeClosed} />
        </Button>
      {/if}
      {#if $room?.isClosed}
        <Button
          class="btn btn-neutral btn-sm tooltip tooltip-left"
          data-tip="Requests to join this room will be ignored.">
          <Icon size={4} icon={MinusCircle} />
        </Button>
      {/if}
    </div>
  </div>
  {#if $room?.about}
    <p>{$room.about}</p>
  {/if}
  {#if $members.length > 0}
    <div class="card2 card2-sm bg-alt flex items-center justify-between gap-4">
      <div class="flex items-center gap-4">
        <span>Members:</span>
        <ProfileCircles pubkeys={$members} />
      </div>
      <Button class="btn btn-neutral btn-sm" onclick={showMembers}>View All</Button>
    </div>
  {/if}
  <ModalFooter>
    <Button class="btn btn-link" onclick={back}>
      <Icon icon={AltArrowLeft} />
      Go back
    </Button>
    <div class="flex gap-2">
      {#if $userIsAdmin}
        <Button class="btn btn-outline btn-error" onclick={startDelete}>
          <Icon icon={TrashBin2} />
          <span class="hidden md:inline">Delete Room</span>
        </Button>
        <Button class="btn btn-primary" onclick={startEdit}>
          <Icon icon={Pen} />
          Edit Room
        </Button>
      {:else if $membershipStatus === MembershipStatus.Initial}
        <Button class="btn btn-neutral" disabled={loading} onclick={join}>
          {#if loading}
            <span class="loading loading-spinner loading-sm"></span>
          {:else}
            <Icon icon={Login3} />
          {/if}
          Join member list
        </Button>
      {:else if $membershipStatus === MembershipStatus.Pending}
        <Button class="btn btn-neutral">
          <Icon icon={ClockCircle} />
          Membership pending
        </Button>
      {:else}
        <Button class="btn btn-neutral" disabled={loading} onclick={leave}>
          {#if loading}
            <span class="loading loading-spinner loading-sm"></span>
          {:else}
            <Icon icon={Login3} />
          {/if}
          Leave member list
        </Button>
      {/if}
    </div>
  </ModalFooter>
</div>
