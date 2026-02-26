<script lang="ts">
  import {ManagementMethod} from "@welshman/util"
  import {manageRelay, displayProfileByPubkey} from "@welshman/app"
  import MenuDots from "@assets/icons/menu-dots.svg?dataurl"
  import UserMinus from "@assets/icons/user-minus.svg?dataurl"
  import MinusCircle from "@assets/icons/minus-circle.svg?dataurl"
  import AddCircle from "@assets/icons/add-circle.svg?dataurl"
  import AltArrowLeft from "@assets/icons/alt-arrow-left.svg?dataurl"
  import {fly} from "@lib/transition"
  import Button from "@lib/components/Button.svelte"
  import Icon from "@lib/components/Icon.svelte"
  import Popover from "@lib/components/Popover.svelte"
  import Confirm from "@lib/components/Confirm.svelte"
  import Modal from "@lib/components/Modal.svelte"
  import ModalBody from "@lib/components/ModalBody.svelte"
  import ModalHeader from "@lib/components/ModalHeader.svelte"
  import ModalTitle from "@lib/components/ModalTitle.svelte"
  import ModalSubtitle from "@lib/components/ModalSubtitle.svelte"
  import ModalFooter from "@lib/components/ModalFooter.svelte"
  import RelayName from "@app/components/RelayName.svelte"
  import Profile from "@app/components/Profile.svelte"
  import SpaceMembersAdd from "@app/components/SpaceMembersAdd.svelte"
  import SpaceMembersBanned from "@app/components/SpaceMembersBanned.svelte"
  import {
    deriveSpaceMembers,
    deriveSpaceBannedPubkeyItems,
    deriveUserIsSpaceAdmin,
    deriveSupportedMethods,
  } from "@app/core/state"
  import {pushModal} from "@app/util/modal"
  import {pushToast} from "@app/util/toast"

  interface Props {
    url: string
  }

  const {url}: Props = $props()

  const members = deriveSpaceMembers(url)
  const bans = deriveSpaceBannedPubkeyItems(url)
  const userIsAdmin = deriveUserIsSpaceAdmin(url)
  const supportedMethods = deriveSupportedMethods(url)
  const canBan = $derived($supportedMethods.includes(ManagementMethod.BanPubkey))
  const canUnallow = $derived($supportedMethods.includes(ManagementMethod.UnallowPubkey))

  const back = () => history.back()

  const toggleMenu = (pubkey: string) => {
    menuPubkey = menuPubkey === pubkey ? undefined : pubkey
  }

  const closeMenu = () => {
    menuPubkey = undefined
  }

  const showBannedPubkeyItems = () => pushModal(SpaceMembersBanned, {url})

  const addMember = () => pushModal(SpaceMembersAdd, {url})

  const unallowMember = (pubkey: string) =>
    pushModal(Confirm, {
      title: "Remove User",
      message: `Are you sure you want to remove @${displayProfileByPubkey(pubkey)} from the space?`,
      confirm: async () => {
        const {error} = await manageRelay(url, {
          method: ManagementMethod.UnallowPubkey,
          params: [pubkey],
        })

        if (error) {
          pushToast({theme: "error", message: error})
        } else {
          pushToast({message: "User has successfully been removed!"})
          back()
        }
      },
    })

  const banMember = (pubkey: string) =>
    pushModal(Confirm, {
      title: "Ban User",
      message: `Are you sure you want to ban @${displayProfileByPubkey(pubkey)} from the space?`,
      confirm: async () => {
        const {error} = await manageRelay(url, {
          method: ManagementMethod.BanPubkey,
          params: [pubkey],
        })

        if (error) {
          pushToast({theme: "error", message: error})
        } else {
          pushToast({message: "User has successfully been banned!"})
          back()
        }
      },
    })

  let menuPubkey = $state<string | undefined>()
</script>

<Modal>
  <ModalBody>
    <ModalHeader>
      <ModalTitle>Members</ModalTitle>
      <ModalSubtitle>of <RelayName {url} class="text-primary" /></ModalSubtitle>
    </ModalHeader>
    {#if $userIsAdmin}
      {#if $bans.length > 0}
        <Button class="btn btn-neutral" onclick={showBannedPubkeyItems}>
          Banned users ({$bans.length})
        </Button>
      {/if}
    {/if}
    <div class="flex flex-col gap-2">
      {#each $members as pubkey (pubkey)}
        <div class="card2 card2-sm bg-alt relative">
          <div class="flex items-center justify-between gap-2">
            <div class="min-w-0 flex-1">
              <Profile {pubkey} {url} />
            </div>
            {#if canBan || canUnallow}
              <div class="relative">
                <Button class="btn btn-circle btn-ghost btn-sm" onclick={() => toggleMenu(pubkey)}>
                  <Icon icon={MenuDots} />
                </Button>
                {#if menuPubkey === pubkey}
                  <Popover hideOnClick onClose={closeMenu}>
                    <ul
                      transition:fly
                      class="menu absolute right-0 z-popover mt-2 w-48 gap-1 rounded-box bg-base-100 p-2 shadow-md">
                      {#if canUnallow}
                        <li>
                          <Button onclick={() => unallowMember(pubkey)}>
                            <Icon icon={UserMinus} />
                            Remove User
                          </Button>
                        </li>
                      {/if}
                      {#if canBan}
                        <li>
                          <Button class="text-error" onclick={() => banMember(pubkey)}>
                            <Icon icon={MinusCircle} />
                            Ban User
                          </Button>
                        </li>
                      {/if}
                    </ul>
                  </Popover>
                {/if}
              </div>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  </ModalBody>
  <ModalFooter>
    <Button class="btn btn-link" onclick={back}>
      <Icon icon={AltArrowLeft} />
      Go back
    </Button>
    <Button class="btn btn-primary" onclick={addMember}>
      <Icon icon={AddCircle} />
      Add members
    </Button>
  </ModalFooter>
</Modal>
