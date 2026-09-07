<script lang="ts">
  import type {Snippet} from "svelte"
  import {Capacitor} from "@capacitor/core"
  import UserCircle from "@assets/icons/user-circle.svg?dataurl"
  import Wallet from "@assets/icons/wallet.svg?dataurl"
  import ServerPath from "@assets/icons/server-path.svg?dataurl"
  import Moon from "@assets/icons/moon.svg?dataurl"
  import Code2 from "@assets/icons/code-2.svg?dataurl"
  import Exit from "@assets/icons/logout-3.svg?dataurl"
  import GalleryMinimalistic from "@assets/icons/gallery-minimalistic.svg?dataurl"
  import Shield from "@assets/icons/shield-minimalistic.svg?dataurl"
  import Bell from "@assets/icons/bell.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Page from "@lib/components/Page.svelte"
  import SecondaryNav from "@lib/components/SecondaryNav.svelte"
  import SecondaryNavItem from "@lib/components/SecondaryNavItem.svelte"
  import SecondaryNavSection from "@lib/components/SecondaryNavSection.svelte"
  import LogOut from "@app/components/LogOut.svelte"
  import {HOSTING_ENABLED} from "@app/hosting"
  import {pushModal} from "@app/modal"

  type Props = {
    children?: Snippet
  }

  const {children}: Props = $props()

  const logout = () => pushModal(LogOut)
</script>

<SecondaryNav>
  <SecondaryNavSection>
    <SecondaryNavItem class="w-full justify-between!">
      <strong class="truncate min-w-0 flex items-center gap-3"> Your Settings </strong>
    </SecondaryNavItem>
    <SecondaryNavItem href="/settings/profile">
      <Icon icon={UserCircle} /> Profile
    </SecondaryNavItem>
    <SecondaryNavItem href="/settings/alerts">
      <Icon icon={Bell} /> Alerts
    </SecondaryNavItem>
    {#if Capacitor.getPlatform() !== "ios"}
      <SecondaryNavItem href="/settings/wallet">
        <Icon icon={Wallet} /> Wallet
      </SecondaryNavItem>
    {/if}
    {#if HOSTING_ENABLED}
      <SecondaryNavItem href="/settings/hosting">
        <Icon icon={ServerPath} /> Hosting
      </SecondaryNavItem>
    {/if}
    <SecondaryNavItem href="/settings/content">
      <Icon icon={GalleryMinimalistic} /> Content
    </SecondaryNavItem>
    <SecondaryNavItem href="/settings/privacy">
      <Icon icon={Shield} /> Privacy
    </SecondaryNavItem>
    <SecondaryNavItem href="/settings/theme">
      <Icon icon={Moon} /> Theme
    </SecondaryNavItem>
    <SecondaryNavItem href="/settings/about">
      <Icon icon={Code2} /> About
    </SecondaryNavItem>
    <SecondaryNavItem class="text-error hover:text-error" onclick={logout}>
      <Icon icon={Exit} /> Log Out
    </SecondaryNavItem>
  </SecondaryNavSection>
</SecondaryNav>

<Page>
  {@render children?.()}
</Page>
