<script lang="ts">
  import MenuDots from "@assets/icons/menu-dots.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import SpaceMenu from "@app/components/SpaceMenu.svelte"
  import {pushDrawer} from "@app/util/modal"
  import {deriveSocketStatus} from "@app/core/state"

  const {url} = $props()

  const status = deriveSocketStatus(url)

  const openMenu = () => pushDrawer(SpaceMenu, {url})
</script>

<Button onclick={openMenu} class="btn btn-neutral btn-sm relative md:hidden">
  <Icon icon={MenuDots} />
  {#if $status.theme !== "success"}
    <div class="absolute right-0 top-0 -mr-1 -mt-1 h-2 w-2 rounded-full bg-{$status.theme}"></div>
  {/if}
</Button>
