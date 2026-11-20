<script lang="ts">
  import type {Snippet} from "svelte"
  import {page} from "$app/state"
  import UserCircle from "@assets/icons/user-circle.svg?dataurl"
  import Wallet from "@assets/icons/wallet.svg?dataurl"
  import ServerPath from "@assets/icons/server-path.svg?dataurl"
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
  import LogInGate from "@app/components/LogInGate.svelte"
  import {ENABLE_ZAPS, ENABLE_HOSTING} from "@app/core/env"
  import {user} from "@app/core/user"
  import {pushModal} from "@app/navigation/dialogs"
  import * as pages from "@app/navigation/pages"

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
    {#if ENABLE_ZAPS}
      <SecondaryNavItem href="/settings/wallet">
        <Icon icon={Wallet} /> Wallet
      </SecondaryNavItem>
    {/if}
    {#if ENABLE_HOSTING}
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
    <SecondaryNavItem href="/settings/about">
      <Icon icon={Code2} /> About
    </SecondaryNavItem>
    {#if $user}
      <SecondaryNavItem class="text-error hover:text-error" onclick={logout}>
        <Icon icon={Exit} /> Log Out
      </SecondaryNavItem>
    {/if}
  </SecondaryNavSection>
</SecondaryNav>

<Page>
  <!-- $app/state's page changes in the same update as children, so a visitor never renders a gated page. -->
  {#if page.route.id === pages.settingsAbout.id}
    {@render children?.()}
  {:else}
    <LogInGate
      title="Log in to change your settings"
      message="Your profile, alerts, wallet and preferences live here.">
      {@render children?.()}
    </LogInGate>
  {/if}
</Page>
