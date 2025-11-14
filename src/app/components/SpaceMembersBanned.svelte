<script lang="ts">
  import {displayRelayUrl, ManagementMethod} from "@welshman/util"
  import {manageRelay} from "@welshman/app"
  import MenuDots from "@assets/icons/menu-dots.svg?dataurl"
  import Restart from "@assets/icons/restart.svg?dataurl"
  import AltArrowLeft from "@assets/icons/alt-arrow-left.svg?dataurl"
  import {fly} from "@lib/transition"
  import Button from "@lib/components/Button.svelte"
  import Icon from "@lib/components/Icon.svelte"
  import Popover from "@lib/components/Popover.svelte"
  import ModalHeader from "@lib/components/ModalHeader.svelte"
  import ModalFooter from "@lib/components/ModalFooter.svelte"
  import Profile from "@app/components/Profile.svelte"
  import {deriveSpaceBannedPubkeyItems} from "@app/core/state"
  import {pushToast} from "@app/util/toast"

  interface Props {
    url: string
  }

  const {url}: Props = $props()

  const bans = deriveSpaceBannedPubkeyItems(url)

  const back = () => history.back()

  const toggleMenu = (pubkey: string) => {
    menuPubkey = menuPubkey === pubkey ? undefined : pubkey
  }

  const closeMenu = () => {
    menuPubkey = undefined
  }

  const restoreMember = async (pubkey: string) => {
    const {error} = await manageRelay(url, {
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

  let menuPubkey = $state<string | undefined>()
</script>

<div class="column gap-4">
  <ModalHeader>
    {#snippet title()}
      <div>Banned users</div>
    {/snippet}
    {#snippet info()}
      <div>on {displayRelayUrl(url)}</div>
    {/snippet}
  </ModalHeader>
  {#each $bans as { pubkey, reason } (pubkey)}
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
                  <Button onclick={() => restoreMember(pubkey)}>
                    <Icon icon={Restart} />
                    Restore User
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
      Got it
    </Button>
  </ModalFooter>
</div>
