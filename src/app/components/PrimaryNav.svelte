<script lang="ts">
  import type {Snippet} from "svelte"
  import cx from "classnames"
  import {Profiles} from "@welshman/app"
  import Letter from "@assets/icons/letter.svg?dataurl"
  import Magnifier from "@assets/icons/magnifier.svg?dataurl"
  import UserRounded from "@assets/icons/user-rounded.svg?dataurl"
  import Settings from "@assets/icons/settings.svg?dataurl"
  import Sidebar from "@assets/icons/sidebar-minimalistic.svg?dataurl"
  import ImageIcon from "@lib/components/ImageIcon.svelte"
  import Divider from "@lib/components/Divider.svelte"
  import PrimaryNavItem from "@lib/components/PrimaryNavItem.svelte"
  import MenuSettings from "@app/components/MenuSettings.svelte"
  import PrimaryNavSpaces from "@app/components/PrimaryNavSpaces.svelte"
  import Search from "@app/components/Search.svelte"
  import SpaceMenuDrawer from "@app/components/SpaceMenuDrawer.svelte"
  import {PLATFORM_RELAYS} from "@app/env"
  import {modal, popModal, pushModal} from "@app/modal"
  import {notifications} from "@app/notifications"
  import {userSpaceUrls} from "@app/rooms"
  import {goToChat, lastSpaceUrl, makeSpacePath} from "@app/routes"
  import {deriveUserItem} from "@app/core"

  type Props = {
    children?: Snippet
  }

  const {children}: Props = $props()

  const userProfile = deriveUserItem(Profiles)

  const chatHandler = () => goToChat()

  const showSettingsMenu = () => pushModal(MenuSettings)

  const showSearch = () => pushModal(Search)

  // The menu is reachable from every page, so it opens on the space the user is in, or the last one
  // they were in when they're somewhere else.
  const spaceUrl = $derived($lastSpaceUrl ?? PLATFORM_RELAYS[0] ?? $userSpaceUrls[0])

  const spaceMenuIsOpen = $derived($modal?.component === SpaceMenuDrawer)

  const spaceMenuLabel = $derived(spaceMenuIsOpen ? "Close space menu" : "Open space menu")

  const toggleSpaceMenu = () =>
    spaceMenuIsOpen ? popModal() : pushModal(SpaceMenuDrawer, {url: spaceUrl}, {drawer: true})

  const otherSpaceNotifications = $derived(
    $userSpaceUrls.some(url => url !== spaceUrl && $notifications.has(makeSpacePath(url))),
  )
</script>

<div
  class={cx("primary-nav ml-sai mt-sai mb-sai hidden md:flex", {
    "justify-between": PLATFORM_RELAYS.length === 0,
  })}>
  <PrimaryNavSpaces />
  {#if PLATFORM_RELAYS.length > 0}
    <Divider />
  {/if}
  <div class="flex flex-col items-center">
    <PrimaryNavItem title="Settings" href="/settings/profile" prefix="/settings">
      {#if $userProfile?.picture()}
        <ImageIcon alt="Settings" src={$userProfile.picture()!} class="rounded-full" size={10} />
      {:else}
        <ImageIcon alt="Settings" src={UserRounded} class="rounded-full" size={8} />
      {/if}
    </PrimaryNavItem>
    <PrimaryNavItem
      title="Messages"
      onclick={chatHandler}
      notification={$notifications.has("/chat")}>
      <ImageIcon alt="Messages" src={Letter} size={8} />
    </PrimaryNavItem>
    <PrimaryNavItem title="Search" onclick={showSearch}>
      <ImageIcon alt="Search" src={Magnifier} size={8} />
    </PrimaryNavItem>
  </div>
</div>

{@render children?.()}

<!-- a little extra something for ios -->
<div class="hide-on-keyboard fixed bottom-0 left-0 right-0 z-nav h-(--saib) bg-surface md:hidden">
</div>
<div
  class="hide-on-keyboard border-top bottom-sai fixed left-0 right-0 z-nav h-(--mobile-nav-height) border border-line bg-surface md:hidden">
  <div class="flex h-full justify-between px-2">
    <div class="flex items-center gap-6">
      {#if spaceUrl}
        <PrimaryNavItem
          onclick={toggleSpaceMenu}
          aria-label={spaceMenuLabel}
          notification={otherSpaceNotifications}>
          <ImageIcon alt={spaceMenuLabel} src={Sidebar} size={8} />
        </PrimaryNavItem>
      {/if}
      <PrimaryNavItem onclick={showSearch}>
        <ImageIcon alt="Search" src={Magnifier} size={8} />
      </PrimaryNavItem>
      <PrimaryNavItem href="/chat" onclick={chatHandler} notification={$notifications.has("/chat")}>
        <ImageIcon alt="Messages" src={Letter} size={8} />
      </PrimaryNavItem>
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
