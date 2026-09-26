<script lang="ts">
  import cx from "classnames"
  import {displayRelayUrl} from "@welshman/util"
  import {fly} from "@lib/transition"
  import AltArrowDown from "@assets/icons/alt-arrow-down.svg?dataurl"
  import BellOff from "@assets/icons/bell-off.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import SpaceMenuMobile from "@app/components/SpaceMenuMobile.svelte"
  import SpaceMenuActions from "@app/components/SpaceMenuActions.svelte"
  import RelayName from "@app/components/RelayName.svelte"
  import {deriveSpaceActionItems} from "@app/actionItems"
  import {deriveShouldNotify} from "@app/settings"
  import {notificationSettings} from "@app/push"
  import {pushModal} from "@app/modal"

  type Props = {
    url: string
    mobile?: boolean
  }

  const {url, mobile = false}: Props = $props()

  const actionItems = deriveSpaceActionItems(url)
  const shouldNotify = deriveShouldNotify(url)

  const openMenu = () => {
    if (mobile) {
      pushModal(SpaceMenuMobile, {url}, {nested: true})
    } else {
      showMenu = true
    }
  }

  const closeMenu = () => {
    showMenu = false
  }

  // Deferred so the click that follows the mouseup still reaches the item before the menu goes.
  const onMouseUp = () => setTimeout(closeMenu)

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      setTimeout(closeMenu)
    }
  }

  let showMenu = $state(false)
</script>

<svelte:window
  onmouseup={showMenu ? onMouseUp : undefined}
  onkeydown={showMenu ? onKeyDown : undefined} />

<Button
  class={cx(
    mobile
      ? "space-menu__header-button text-content"
      : "relative flex w-full flex-col rounded-xl p-3 transition-all hover:bg-surface",
  )}
  onclick={openMenu}>
  <div class="flex items-center justify-between">
    <strong class="flex items-center gap-1 relative">
      <RelayName {url} class="truncate min-w-0" />
      <div
        class={cx(
          "absolute -right-3 top-0 h-2 w-2 rounded-full bg-primary text-primary-content transition-all",
          $actionItems.length > 0 ? "opacity-100" : "opacity-0",
        )}>
      </div>
      {#if $notificationSettings.push && !$shouldNotify}
        <Icon icon={BellOff} size={3} class="opacity-50" />
      {/if}
    </strong>
    <Icon icon={AltArrowDown} />
  </div>
  <span class="text-xs text-primary">{displayRelayUrl(url)}</span>
</Button>
{#if showMenu && !mobile}
  <div class="relative w-full">
    <ul transition:fly class="menu absolute z-popover mt-2 w-full gap-1 rounded-2xl bg-surface p-2">
      <SpaceMenuActions {url} />
    </ul>
  </div>
{/if}
