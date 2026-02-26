<script lang="ts">
  import {displayRelayUrl, ManagementMethod} from "@welshman/util"
  import {manageRelay} from "@welshman/app"
  import MenuDots from "@assets/icons/menu-dots.svg?dataurl"
  import Restart from "@assets/icons/restart.svg?dataurl"
  import CloseCircle from "@assets/icons/close-circle.svg?dataurl"
  import AltArrowLeft from "@assets/icons/alt-arrow-left.svg?dataurl"
  import {fly} from "@lib/transition"
  import Button from "@lib/components/Button.svelte"
  import Icon from "@lib/components/Icon.svelte"
  import Popover from "@lib/components/Popover.svelte"
  import Modal from "@lib/components/Modal.svelte"
  import ModalBody from "@lib/components/ModalBody.svelte"
  import ModalHeader from "@lib/components/ModalHeader.svelte"
  import ModalTitle from "@lib/components/ModalTitle.svelte"
  import ModalSubtitle from "@lib/components/ModalSubtitle.svelte"
  import ModalFooter from "@lib/components/ModalFooter.svelte"
  import Profile from "@app/components/Profile.svelte"
  import {deriveSpaceBannedPubkeyItems, deriveSupportedMethods} from "@app/core/state"
  import {pushToast} from "@app/util/toast"

  interface Props {
    url: string
  }

  const {url}: Props = $props()

  const bans = deriveSpaceBannedPubkeyItems(url)
  const supportedMethods = deriveSupportedMethods(url)
  const canUnban = $derived($supportedMethods.includes(ManagementMethod.UnbanPubkey))
  const canRestore = $derived($supportedMethods.includes(ManagementMethod.AllowPubkey))

  const back = () => history.back()

  const toggleMenu = (pubkey: string) => {
    menuPubkey = menuPubkey === pubkey ? undefined : pubkey
  }

  const closeMenu = () => {
    menuPubkey = undefined
  }

  const unbanMember = async (pubkey: string) => {
    const {error} = await manageRelay(url, {
      method: ManagementMethod.UnbanPubkey,
      params: [pubkey],
    })

    if (error) {
      pushToast({theme: "error", message: error})
    } else {
      pushToast({message: "User has successfully been removed from the ban list!"})
      back()
    }
  }

  const restoreMember = async (pubkey: string) => {
    const {error} = await manageRelay(url, {
      method: ManagementMethod.AllowPubkey,
      params: [pubkey],
    })

    if (error) {
      pushToast({theme: "error", message: error})
    } else {
      pushToast({message: "User has successfully been restored to membership!"})
      back()
    }
  }

  let menuPubkey = $state<string | undefined>()
</script>

<Modal>
  <ModalBody>
    <ModalHeader>
      <ModalTitle>Banned users</ModalTitle>
      <ModalSubtitle>on {displayRelayUrl(url)}</ModalSubtitle>
    </ModalHeader>
    <div class="flex flex-col gap-2">
      {#each $bans as { pubkey, reason } (pubkey)}
        <div class="card2 bg-alt relative">
          <div class="flex items-center justify-between gap-2">
            <div class="min-w-0 flex-1">
              <Profile {pubkey} {url} />
            </div>
            {#if canUnban || canRestore}
              <div class="relative">
                <Button class="btn btn-circle btn-ghost btn-sm" onclick={() => toggleMenu(pubkey)}>
                  <Icon icon={MenuDots} />
                </Button>
                {#if menuPubkey === pubkey}
                  <Popover hideOnClick onClose={closeMenu}>
                    <ul
                      transition:fly
                      class="menu absolute right-0 z-popover mt-2 w-48 gap-1 rounded-box bg-base-100 p-2 shadow-md">
                      {#if canUnban}
                        <li>
                          <Button onclick={() => unbanMember(pubkey)}>
                            <Icon icon={CloseCircle} />
                            Unban User
                          </Button>
                        </li>
                      {/if}
                      {#if canRestore}
                        <li>
                          <Button onclick={() => restoreMember(pubkey)}>
                            <Icon icon={Restart} />
                            Restore User
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
      Got it
    </Button>
  </ModalFooter>
</Modal>
