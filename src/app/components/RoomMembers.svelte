<script lang="ts">
  import {waitForThunkError, removeRoomMember} from "@welshman/app"
  import MenuDots from "@assets/icons/menu-dots.svg?dataurl"
  import MinusCircle from "@assets/icons/minus-circle.svg?dataurl"
  import AddCircle from "@assets/icons/add-circle.svg?dataurl"
  import AltArrowLeft from "@assets/icons/alt-arrow-left.svg?dataurl"
  import {fly} from "@lib/transition"
  import Button from "@lib/components/Button.svelte"
  import Icon from "@lib/components/Icon.svelte"
  import Popover from "@lib/components/Popover.svelte"
  import Confirm from "@lib/components/Confirm.svelte"
  import ModalFooter from "@lib/components/ModalFooter.svelte"
  import Profile from "@app/components/Profile.svelte"
  import RoomName from "@app/components/RoomName.svelte"
  import RoomMembersAdd from "@app/components/RoomMembersAdd.svelte"
  import {deriveRoom, deriveRoomMembers, deriveUserIsRoomAdmin} from "@app/core/state"
  import {pushModal} from "@app/util/modal"
  import {pushToast} from "@app/util/toast"

  interface Props {
    url: string
    h: string
  }

  const {url, h}: Props = $props()

  const room = deriveRoom(url, h)
  const members = deriveRoomMembers(url, h)
  const userIsAdmin = deriveUserIsRoomAdmin(url, h)

  const back = () => history.back()

  const toggleMenu = (pubkey: string) => {
    menuPubkey = menuPubkey === pubkey ? undefined : pubkey
  }

  const closeMenu = () => {
    menuPubkey = undefined
  }

  const addMember = () => pushModal(RoomMembersAdd, {url, h})

  const removeMember = (pubkey: string) =>
    pushModal(Confirm, {
      title: "Remove Member",
      message: "Are you sure you want to remove this user from the room?",
      confirm: async () => {
        const error = await waitForThunkError(removeRoomMember(url, $room, pubkey))

        if (error) {
          pushToast({theme: "error", message: error})
        } else {
          pushToast({message: "Member has successfully been removed!"})
          back()
        }
      },
    })

  let menuPubkey = $state<string | undefined>()
</script>

<div class="column gap-4">
  <div class="flex min-w-0 flex-col gap-1">
    <h1 class="ellipsize whitespace-nowrap text-2xl font-bold">Members</h1>
    <p class="ellipsize text-sm opacity-75">of <RoomName {url} {h} /></p>
  </div>
  {#if $userIsAdmin}
    <div class="flex gap-2">
      <Button class="btn btn-primary" onclick={addMember}>
        <Icon icon={AddCircle} />
        Add members
      </Button>
    </div>
  {/if}
  {#each $members as pubkey (pubkey)}
    <div class="card2 bg-alt relative">
      <div class="flex items-center justify-between gap-2">
        <div class="min-w-0 flex-1">
          <Profile {pubkey} {url} />
        </div>
        <div class="relative">
          <Button class="btn btn-circle btn-ghost btn-sm" onclick={() => toggleMenu(pubkey)}>
            <Icon icon={MenuDots} />
          </Button>
          {#if menuPubkey === pubkey}
            <Popover hideOnClick onClose={closeMenu}>
              <ul
                transition:fly
                class="menu absolute right-0 z-popover mt-2 w-48 gap-1 rounded-box bg-base-100 p-2 shadow-md">
                <li>
                  <Button class="text-error" onclick={() => removeMember(pubkey)}>
                    <Icon icon={MinusCircle} />
                    Remove Member
                  </Button>
                </li>
              </ul>
            </Popover>
          {/if}
        </div>
      </div>
    </div>
  {/each}
  <ModalFooter>
    <Button class="btn btn-link" onclick={back}>
      <Icon icon={AltArrowLeft} />
      Go back
    </Button>
  </ModalFooter>
</div>
