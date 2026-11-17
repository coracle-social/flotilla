<script lang="ts">
  import type {Snippet} from "svelte"
  import Bookmark from "@assets/icons/nav/bookmark.png"
  import Compass from "@assets/icons/nav/compass.png"
  import Letter from "@assets/icons/nav/letter.png"
  import Magnifier from "@assets/icons/nav/magnifier.png"
  import UserRounded from "@assets/icons/user-rounded.svg?dataurl"
  import Settings from "@assets/icons/settings.svg?dataurl"
  import Sidebar from "@assets/icons/sidebar-minimalistic.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import ImageIcon from "@lib/components/ImageIcon.svelte"
  import Divider from "@lib/components/Divider.svelte"
  import PrimaryNavItem from "@lib/components/PrimaryNavItem.svelte"
  import MenuSettings from "@app/components/MenuSettings.svelte"
  import PrimaryNavSpaces from "@app/components/PrimaryNavSpaces.svelte"
  import Search from "@app/components/Search.svelte"
  import SpaceMenuDrawer from "@app/components/SpaceMenuDrawer.svelte"
  import {PLATFORM_RELAYS} from "@app/core/env"
  import {getModal, popModal, pushModal} from "@app/navigation/dialogs"
  import {notifications} from "@app/features/activity"
  import {userSpaceUrls} from "@app/core/user"
  import * as pages from "@app/navigation/pages"
  import {openMessages} from "@app/components/flows/messages"
  import {lastSpaceUrl} from "@app/navigation/history"
  import {userProfile} from "@app/core/user"

  type Props = {
    children?: Snippet
  }

  const {children}: Props = $props()

  const chatHandler = () => openMessages()

  const showSettingsMenu = () => pushModal(MenuSettings)

  const showSearch = () => pushModal(Search)

  // The menu is reachable everywhere, so it opens on the space the user is in, or the last one.
  const spaceUrl = $derived($lastSpaceUrl ?? PLATFORM_RELAYS[0] ?? $userSpaceUrls[0])

  const spaceMenuIsOpen = $derived(getModal()?.component === SpaceMenuDrawer)

  const spaceMenuLabel = $derived(spaceMenuIsOpen ? "Close space menu" : "Open space menu")

  const toggleSpaceMenu = () =>
    spaceMenuIsOpen ? popModal() : pushModal(SpaceMenuDrawer, {url: spaceUrl}, {drawer: true})

  const otherSpaceNotifications = $derived(
    $userSpaceUrls.some(url => url !== spaceUrl && $notifications.has(pages.space.path({url}))),
  )
</script>

<div class="primary-nav ml-sai mt-sai hidden md:flex">
  <PrimaryNavSpaces />
  {#if PLATFORM_RELAYS.length > 0}
    <Divider />
  {/if}
  <div class="mt-auto flex flex-col items-center">
    <PrimaryNavItem title="Settings" href="/settings/profile" prefix="/settings">
      {#if $userProfile?.picture()}
        <ImageIcon alt="Settings" src={$userProfile.picture()!} class="rounded-full" size={10} />
      {:else}
        <ImageIcon alt="Settings" src={UserRounded} class="rounded-full" size={8} />
      {/if}
    </PrimaryNavItem>
    {#if PLATFORM_RELAYS.length === 0}
      <PrimaryNavItem
        href="/spaces"
        title="All Spaces"
        prefix="no-highlight"
        aria-label="All Spaces">
        <Icon icon={Compass} size={10} />
      </PrimaryNavItem>
    {/if}
    <PrimaryNavItem
      title="Messages"
      aria-label="Messages"
      onclick={chatHandler}
      notification={$notifications.has("/chat")}>
      <Icon icon={Letter} size={10} />
    </PrimaryNavItem>
    <PrimaryNavItem
      title="Bookmarks"
      href="/bookmarks"
      prefix="no-highlight"
      aria-label="Bookmarks">
      <Icon icon={Bookmark} size={10} />
    </PrimaryNavItem>
    <PrimaryNavItem title="Search" onclick={showSearch} aria-label="Search">
      <Icon icon={Magnifier} size={10} />
    </PrimaryNavItem>
  </div>
</div>

{@render children?.()}

<div class="mobile-nav md:hidden">
  <!-- a little extra something for ios -->
  <div class="hide-on-keyboard fixed bottom-0 left-0 right-0 z-nav h-(--saib) bg-surface"></div>
  <div
    class="hide-on-keyboard border-top bottom-sai fixed left-0 right-0 z-nav h-(--mobile-nav-height) border border-line bg-surface">
    <div class="flex h-full justify-between px-2">
      <div class="flex items-center gap-6">
        <PrimaryNavItem
          onclick={toggleSpaceMenu}
          aria-label={spaceMenuLabel}
          notification={otherSpaceNotifications}>
          <ImageIcon alt={spaceMenuLabel} src={Sidebar} size={8} />
        </PrimaryNavItem>
        <PrimaryNavItem onclick={showSearch} aria-label="Search">
          <Icon icon={Magnifier} size={8} />
        </PrimaryNavItem>
        <PrimaryNavItem
          href="/chat"
          aria-label="Messages"
          onclick={chatHandler}
          notification={$notifications.has("/chat")}>
          <Icon icon={Letter} size={8} />
        </PrimaryNavItem>
        {#if PLATFORM_RELAYS.length === 0}
          <PrimaryNavItem href="/spaces" aria-label="All Spaces">
            <Icon icon={Compass} size={8} />
          </PrimaryNavItem>
        {/if}
      </div>
      <PrimaryNavItem onclick={showSettingsMenu} aria-label="Settings">
        {#if $userProfile?.picture()}
          <ImageIcon alt="Settings" src={$userProfile.picture()!} size={10} class="rounded-full" />
        {:else}
          <ImageIcon alt="Settings" src={Settings} size={8} class="rounded-full" />
        {/if}
      </PrimaryNavItem>
    </div>
  </div>
</div>
