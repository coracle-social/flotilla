<script lang="ts">
  import type {Snippet} from "svelte"
  import cx from "classnames"
  import {Profiles} from "@welshman/app"
  import Letter from "@assets/icons/letter.svg?dataurl"
  import Magnifier from "@assets/icons/magnifier.svg?dataurl"
  import Widget from "@assets/icons/widget-4.svg?dataurl"
  import UserRounded from "@assets/icons/user-rounded.svg?dataurl"
  import Settings from "@assets/icons/settings.svg?dataurl"
  import ImageIcon from "@lib/components/ImageIcon.svelte"
  import Divider from "@lib/components/Divider.svelte"
  import PrimaryNavItem from "@lib/components/PrimaryNavItem.svelte"
  import MenuSettings from "@app/components/MenuSettings.svelte"
  import PrimaryNavItemSpace from "@app/components/PrimaryNavItemSpace.svelte"
  import PrimaryNavSpaces from "@app/components/PrimaryNavSpaces.svelte"
  import {userSpaceUrls} from "@app/rooms"
  import {PLATFORM_RELAYS} from "@app/env"
  import {pushModal} from "@app/modal"
  import {notifications} from "@app/notifications"
  import {goToChat, makeSpacePath} from "@app/routes"
  import {deriveUserItem} from "@app/core"

  type Props = {
    children?: Snippet
  }

  const {children}: Props = $props()

  const userProfile = deriveUserItem(Profiles)

  const chatHandler = () => goToChat()

  const showSettingsMenu = () => pushModal(MenuSettings)

  const anySpaceNotifications = $derived(
    $userSpaceUrls.some(p => $notifications.has(makeSpacePath(p))),
  )
</script>

<div class={cx("primary-nav", {"justify-between": PLATFORM_RELAYS.length === 0})}>
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
    <PrimaryNavItem title="Search" href="/people">
      <ImageIcon alt="Search" src={Magnifier} size={8} />
    </PrimaryNavItem>
  </div>
</div>

{@render children?.()}

<!-- a little extra something for ios -->
<div class="hide-on-keyboard fixed bottom-0 left-0 right-0 z-nav h-(--saib) bg-surface md:hidden">
</div>
<div
  class="hide-on-keyboard border-top bottom-sai fixed left-0 right-0 z-nav h-14 border border-line bg-surface md:hidden">
  <div class="flex h-full justify-between px-2">
    <div class="flex items-center gap-6">
      {#if PLATFORM_RELAYS.length === 1}
        <PrimaryNavItemSpace url={PLATFORM_RELAYS[0]} />
      {:else}
        <PrimaryNavItem href="/people">
          <ImageIcon alt="Search" src={Magnifier} size={8} />
        </PrimaryNavItem>
      {/if}
      <PrimaryNavItem href="/chat" onclick={chatHandler} notification={$notifications.has("/chat")}>
        <ImageIcon alt="Messages" src={Letter} size={8} />
      </PrimaryNavItem>
      {#if PLATFORM_RELAYS.length !== 1}
        <PrimaryNavItem href="/spaces" notification={anySpaceNotifications}>
          <ImageIcon alt="Spaces" src={Widget} size={8} />
        </PrimaryNavItem>
      {/if}
    </div>
    <PrimaryNavItem onclick={showSettingsMenu}>
      {#if $userProfile?.picture()}
        <ImageIcon alt="Settings" src={$userProfile.picture()!} size={10} class="rounded-full" />
      {:else}
        <ImageIcon alt="Settings" src={Settings} size={8} class="rounded-full" />
      {/if}
    </PrimaryNavItem>
  </div>
</div>
