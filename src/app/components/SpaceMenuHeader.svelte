<script lang="ts">
  import cx from "classnames"
  import {displayRelayUrl} from "@welshman/util"
  import {fly} from "@lib/transition"
  import AltArrowDown from "@assets/icons/alt-arrow-down.svg?dataurl"
  import BellOff from "@assets/icons/bell-off.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import Popover from "@lib/components/Popover.svelte"
  import SpaceMenuMobile from "@app/components/SpaceMenuMobile.svelte"
  import SpaceMenuActions from "@app/components/SpaceMenuActions.svelte"
  import RelayName from "@app/components/RelayName.svelte"
  import {deriveSpaceActionItems} from "@app/actionItems"
  import {notificationSettings, deriveShouldNotify} from "@app/settings"
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

  const toggleMenu = () => {
    showMenu = !showMenu
  }

  let showMenu = $state(false)
</script>

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
  <Popover hideOnClick onClose={toggleMenu}>
    <ul transition:fly class="menu absolute z-popover mt-2 w-full gap-1 rounded-2xl bg-surface p-2">
      <SpaceMenuActions {url} />
    </ul>
  </Popover>
{/if}
