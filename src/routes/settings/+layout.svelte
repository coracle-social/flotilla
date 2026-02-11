<script lang="ts">
  import type {Snippet} from "svelte"
  import {Capacitor} from "@capacitor/core"
  import {fly} from "@lib/transition"
  import UserCircle from "@assets/icons/user-circle.svg?dataurl"
  import Wallet from "@assets/icons/wallet.svg?dataurl"
  import Server from "@assets/icons/server.svg?dataurl"
  import Moon from "@assets/icons/moon.svg?dataurl"
  import InfoSquare from "@assets/icons/info-square.svg?dataurl"
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
  import {pushModal} from "@app/util/modal"
  import {theme} from "@app/util/theme"

  type Props = {
    children?: Snippet
  }

  const {children}: Props = $props()

  const logout = () => pushModal(LogOut)

  const toggleTheme = () => theme.set($theme === "dark" ? "light" : "dark")
</script>

<SecondaryNav>
  <SecondaryNavSection>
    <SecondaryNavItem class="w-full !justify-between">
      <strong class="ellipsize flex items-center gap-3"> Your Settings </strong>
    </SecondaryNavItem>
    <div in:fly|local>
      <SecondaryNavItem href="/settings/profile">
        <Icon icon={UserCircle} /> Profile
      </SecondaryNavItem>
    </div>
    <div in:fly|local={{delay: 50}}>
      <SecondaryNavItem href="/settings/alerts">
        <Icon icon={Bell} /> Alerts
      </SecondaryNavItem>
    </div>
    {#if Capacitor.getPlatform() !== "ios"}
      <div in:fly|local={{delay: 100}}>
        <SecondaryNavItem href="/settings/wallet">
          <Icon icon={Wallet} /> Wallet
        </SecondaryNavItem>
      </div>
    {/if}
    <div in:fly|local={{delay: 150}}>
      <SecondaryNavItem href="/settings/relays">
        <Icon icon={Server} /> Relays
      </SecondaryNavItem>
    </div>
    <div in:fly|local={{delay: 200}}>
      <SecondaryNavItem href="/settings/content">
        <Icon icon={GalleryMinimalistic} /> Content
      </SecondaryNavItem>
    </div>
    <div in:fly|local={{delay: 250}}>
      <SecondaryNavItem href="/settings/privacy">
        <Icon icon={Shield} /> Privacy
      </SecondaryNavItem>
    </div>
    <div in:fly|local={{delay: 300}}>
      <SecondaryNavItem onclick={toggleTheme}>
        <Icon icon={Moon} /> Theme
      </SecondaryNavItem>
    </div>
    <div in:fly|local={{delay: 350}}>
      <SecondaryNavItem href="/settings/about">
        <Icon icon={InfoSquare} /> About
      </SecondaryNavItem>
    </div>
    <div in:fly|local={{delay: 400}}>
      <SecondaryNavItem class="text-error hover:text-error" onclick={logout}>
        <Icon icon={Exit} /> Log Out
      </SecondaryNavItem>
    </div>
  </SecondaryNavSection>
</SecondaryNav>

<Page>
  {@render children?.()}
</Page>
