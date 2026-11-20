<script lang="ts">
  import Bookmark from "@assets/icons/bookmark.svg?dataurl"
  import UserCircle from "@assets/icons/user-circle.svg?dataurl"
  import ServerPath from "@assets/icons/server-path.svg?dataurl"
  import GalleryMinimalistic from "@assets/icons/gallery-minimalistic.svg?dataurl"
  import Shield from "@assets/icons/shield-minimalistic.svg?dataurl"
  import Bell from "@assets/icons/bell.svg?dataurl"
  import Wallet from "@assets/icons/wallet.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import Modal from "@lib/components/Modal.svelte"
  import ModalBody from "@lib/components/ModalBody.svelte"
  import Link from "@app/components/Link.svelte"
  import Profile from "@app/components/Profile.svelte"
  import LogOut from "@app/components/LogOut.svelte"
  import LogIn from "@app/components/LogIn.svelte"
  import {user} from "@app/core/user"
  import {ENABLE_ZAPS, ENABLE_HOSTING} from "@app/core/env"
  import {pushModal} from "@app/navigation/dialogs"
  import * as pages from "@app/navigation/pages"

  const logout = () => pushModal(LogOut)

  const logIn = () => pushModal(LogIn)
</script>

<Modal label="Settings">
  <ModalBody>
    <div class="flex flex-col gap-8 items-center py-12 max-w-[16rem] m-auto w-full">
      {#if $user}
        <Link href={pages.profile.path({pubkey: $user.pubkey})}>
          <Profile inert pubkey={$user.pubkey} />
        </Link>
      {:else}
        <Button class="button button-primary w-full" onclick={logIn}>Log in</Button>
      {/if}
      <div class="grid grid-cols-3 gap-3 w-full">
        <Link
          href="/bookmarks"
          class="aspect-square button button-neutral h-[unset] flex flex-col gap-2 text-center text-xs">
          <Icon icon={Bookmark} size={5} />
          Saved
        </Link>
        <Link
          href="/settings/profile"
          class="aspect-square button button-neutral h-[unset] flex flex-col gap-2 text-center text-xs">
          <Icon icon={UserCircle} size={5} />
          Profile
        </Link>
        <Link
          href="/settings/alerts"
          class="aspect-square button button-neutral h-[unset] flex flex-col gap-2 text-center text-xs">
          <Icon icon={Bell} size={5} />
          Alerts
        </Link>
        {#if ENABLE_ZAPS}
          <Link
            href="/settings/wallet"
            class="aspect-square button button-neutral h-[unset] flex flex-col gap-2 text-center text-xs">
            <Icon icon={Wallet} size={5} />
            Wallet
          </Link>
        {/if}
        {#if ENABLE_HOSTING}
          <Link
            href="/settings/hosting"
            class="aspect-square button button-neutral h-[unset] flex flex-col gap-2 text-center text-xs">
            <Icon icon={ServerPath} size={5} />
            Hosting
          </Link>
        {/if}
        <Link
          href="/settings/content"
          class="aspect-square button button-neutral h-[unset] flex flex-col gap-2 text-center text-xs">
          <Icon icon={GalleryMinimalistic} size={5} />
          Content
        </Link>
        <Link
          href="/settings/privacy"
          class="aspect-square button button-neutral h-[unset] flex flex-col gap-2 text-center text-xs">
          <Icon icon={Shield} size={5} />
          Privacy
        </Link>
      </div>
      <div class="flex gap-3 items-center opacity-75 text-sm">
        <Link href="/settings/about">About</Link>
        {#if $user}
          /
          <Button onclick={logout}>Log Out</Button>
        {/if}
      </div>
    </div>
  </ModalBody>
</Modal>
