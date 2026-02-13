<script lang="ts">
  import {onMount} from "svelte"
  import {goto} from "$app/navigation"
  import {removeUndefined} from "@welshman/lib"
  import {ManagementMethod} from "@welshman/util"
  import {
    shouldUnwrap,
    manageRelay,
    deriveProfile,
    displayProfileByPubkey,
    loadMessagingRelayList,
  } from "@welshman/app"
  import AltArrowLeft from "@assets/icons/alt-arrow-left.svg?dataurl"
  import Code2 from "@assets/icons/code-2.svg?dataurl"
  import Letter from "@assets/icons/letter-opened.svg?dataurl"
  import MenuDots from "@assets/icons/menu-dots.svg?dataurl"
  import MinusCircle from "@assets/icons/minus-circle.svg?dataurl"
  import Restart from "@assets/icons/restart.svg?dataurl"
  import {fly} from "@lib/transition"
  import Icon from "@lib/components/Icon.svelte"
  import ImageIcon from "@lib/components/ImageIcon.svelte"
  import Link from "@lib/components/Link.svelte"
  import Confirm from "@lib/components/Confirm.svelte"
  import Button from "@lib/components/Button.svelte"
  import Popover from "@lib/components/Popover.svelte"
  import Modal from "@lib/components/Modal.svelte"
  import ModalBody from "@lib/components/ModalBody.svelte"
  import ModalFooter from "@lib/components/ModalFooter.svelte"
  import Profile from "@app/components/Profile.svelte"
  import ProfileInfo from "@app/components/ProfileInfo.svelte"
  import EventInfo from "@app/components/EventInfo.svelte"
  import ProfileBadges from "@app/components/ProfileBadges.svelte"
  import ChatEnable from "@app/components/ChatEnable.svelte"
  import {pubkeyLink, deriveUserIsSpaceAdmin, deriveSpaceBannedPubkeyItems} from "@app/core/state"
  import {pushModal} from "@app/util/modal"
  import {pushToast} from "@app/util/toast"
  import {makeChatPath} from "@app/util/routes"

  export type Props = {
    pubkey: string
    url?: string
  }

  const {pubkey, url}: Props = $props()

  const profile = deriveProfile(pubkey, removeUndefined([url]))

  const userIsAdmin = deriveUserIsSpaceAdmin(url)

  const bannedPubkeys = url ? deriveSpaceBannedPubkeyItems(url) : undefined

  const isBanned = $derived($bannedPubkeys?.some(item => item.pubkey === pubkey) ?? false)

  const back = () => history.back()

  const chatPath = makeChatPath([pubkey])

  const showInfo = () => pushModal(EventInfo, {url, event: $profile!.event})

  const openChat = () => ($shouldUnwrap ? goto(chatPath) : pushModal(ChatEnable, {next: chatPath}))

  const toggleMenu = (pubkey: string) => {
    showMenu = !showMenu
  }

  const closeMenu = () => {
    showMenu = false
  }

  const banMember = () =>
    pushModal(Confirm, {
      title: "Ban User",
      message: `Are you sure you want to ban @${displayProfileByPubkey(pubkey)} from the space?`,
      confirm: async () => {
        const {error} = await manageRelay(url!, {
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

  const restoreMember = async () => {
    const {error} = await manageRelay(url!, {
      method: ManagementMethod.AllowPubkey,
      params: [pubkey],
    })

    if (error) {
      pushToast({theme: "error", message: error})
    } else {
      pushToast({message: "User has successfully been restored!"})
      back()
    }
  }

  let showMenu = $state(false)

  onMount(() => {
    loadMessagingRelayList(pubkey)
  })
</script>

<Modal>
  <ModalBody>
    <div class="flex flex-col gap-4">
      <div class="flex justify-between">
        <Profile showPubkey avatarSize={14} {pubkey} {url} />
        {#if $profile || $userIsAdmin}
          <div class="relative">
            <Button class="btn btn-circle btn-ghost btn-sm" onclick={() => toggleMenu(pubkey)}>
              <Icon icon={MenuDots} />
            </Button>
            {#if showMenu}
              <Popover hideOnClick onClose={closeMenu}>
                <ul
                  transition:fly
                  class="bg-alt menu absolute right-0 z-popover w-48 gap-1 rounded-box p-2 shadow-md">
                  {#if $profile}
                    <li>
                      <Button onclick={showInfo}>
                        <Icon icon={Code2} />
                        User Details
                      </Button>
                    </li>
                  {/if}
                  {#if $userIsAdmin}
                    {#if isBanned}
                      <li>
                        <Button onclick={restoreMember}>
                          <Icon icon={Restart} />
                          Restore User
                        </Button>
                      </li>
                    {:else}
                      <li>
                        <Button class="text-error" onclick={banMember}>
                          <Icon icon={MinusCircle} />
                          Ban User
                        </Button>
                      </li>
                    {/if}
                  {/if}
                </ul>
              </Popover>
            {/if}
          </div>
        {/if}
      </div>
      <ProfileInfo {pubkey} {url} />
      <ProfileBadges {pubkey} {url} />
    </div>
  </ModalBody>
  <ModalFooter>
    <Button onclick={back} class="hidden md:btn md:btn-link">
      <Icon icon={AltArrowLeft} />
      Go back
    </Button>
    <div class="flex gap-2">
      <Link external href={pubkeyLink(pubkey)} class="btn btn-neutral">
        <ImageIcon alt="" src="/coracle.png" />
        Open in Coracle
      </Link>
      <Button onclick={openChat} class="btn btn-primary">
        <Icon icon={Letter} />
        Message
      </Button>
    </div>
  </ModalFooter>
</Modal>
