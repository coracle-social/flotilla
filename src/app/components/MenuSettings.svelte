<script lang="ts">
  import {Capacitor} from "@capacitor/core"
  import ServerPath from "@assets/icons/server-path.svg?dataurl"
  import GalleryMinimalistic from "@assets/icons/gallery-minimalistic.svg?dataurl"
  import Shield from "@assets/icons/shield-minimalistic.svg?dataurl"
  import Bell from "@assets/icons/bell.svg?dataurl"
  import Wallet from "@assets/icons/wallet.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Link from "@lib/components/Link.svelte"
  import Button from "@lib/components/Button.svelte"
  import Modal from "@lib/components/Modal.svelte"
  import ModalBody from "@lib/components/ModalBody.svelte"
  import Profile from "@app/components/Profile.svelte"
  import LogOut from "@app/components/LogOut.svelte"
  import {user} from "@app/core"
  import {pushModal} from "@app/modal"

  const logout = () => pushModal(LogOut)
</script>

<Modal>
  <ModalBody>
    <div class="flex flex-col gap-8 items-center py-12 max-w-[16rem] m-auto w-full">
      <Link href="/settings/profile">
        <Profile inert pubkey={$user.pubkey} />
      </Link>
      <div class="grid grid-cols-3 gap-3 w-full">
        <Link
          href="/settings/alerts"
          class="aspect-square button button-neutral h-[unset] flex flex-col gap-2 text-center">
          <Icon icon={Bell} size={5} />
          Alerts
        </Link>
        {#if Capacitor.getPlatform() !== "ios"}
          <Link
            href="/settings/wallet"
            class="aspect-square button button-neutral h-[unset] flex flex-col gap-2 text-center">
            <Icon icon={Wallet} size={5} />
            Wallet
          </Link>
        {/if}
        <Link
          href="/settings/hosting"
          class="aspect-square button button-neutral h-[unset] flex flex-col gap-2 text-center">
          <Icon icon={ServerPath} size={5} />
          Hosting
        </Link>
        <Link
          href="/settings/content"
          class="aspect-square button button-neutral h-[unset] flex flex-col gap-2 text-center">
          <Icon icon={GalleryMinimalistic} size={5} />
          Content
        </Link>
        <Link
          href="/settings/privacy"
          class="aspect-square button button-neutral h-[unset] flex flex-col gap-2 text-center">
          <Icon icon={Shield} size={5} />
          Privacy
        </Link>
      </div>
      <div class="flex gap-3 items-center opacity-75 text-sm">
        <Link href="/settings/theme">Theme</Link>
        /
        <Link href="/settings/about">About</Link>
        /
        <Button onclick={logout}>Log Out</Button>
      </div>
    </div>
  </ModalBody>
</Modal>
