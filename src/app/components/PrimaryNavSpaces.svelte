<script lang="ts">
  import {splitAt} from "@welshman/lib"
  import Widget from "@assets/icons/widget-4.svg?dataurl"
  import ImageIcon from "@lib/components/ImageIcon.svelte"
  import Divider from "@lib/components/Divider.svelte"
  import Tippy from "@lib/components/Tippy.svelte"
  import PrimaryNavItem from "@lib/components/PrimaryNavItem.svelte"
  import PrimaryNavItemSpace from "@app/components/PrimaryNavItemSpace.svelte"
  import PrimaryNavSpacesOverflow from "@app/components/PrimaryNavSpacesOverflow.svelte"
  import {userSpaceUrls} from "@app/rooms"
  import {PLATFORM_RELAYS, PLATFORM_LOGO} from "@app/env"
  import {notifications} from "@app/notifications"

  let windowHeight = $state(0)

  const itemHeight = 56
  const navPadding = 8 * itemHeight
  const itemLimit = $derived(Math.max(0, (windowHeight - navPadding) / itemHeight))
  const [primarySpaceUrls, secondarySpaceUrls] = $derived(splitAt(itemLimit, $userSpaceUrls))
  const otherSpaceNotifications = $derived(secondarySpaceUrls.some(p => $notifications.has(p)))

  // Tippy mounts its content component once, so pass a stable reactive object it can read from
  const overflowProps = $state({urls: [] as string[]})

  $effect(() => {
    overflowProps.urls = secondarySpaceUrls
  })
</script>

<svelte:window bind:innerHeight={windowHeight} />

<div class="flex flex-col items-center">
  {#each PLATFORM_RELAYS as url (url)}
    <PrimaryNavItemSpace {url} />
  {:else}
    <PrimaryNavItem title="Home" href="/home">
      <ImageIcon alt="Home" src={PLATFORM_LOGO} class="rounded-full" size={10} />
    </PrimaryNavItem>
    <Divider />
    {#each primarySpaceUrls as url (url)}
      <PrimaryNavItemSpace {url} />
    {/each}
    {#snippet allSpaces(title: string)}
      <PrimaryNavItem
        href="/spaces"
        {title}
        prefix="no-highlight"
        notification={otherSpaceNotifications}>
        <ImageIcon alt="All Spaces" src={Widget} size={8} />
      </PrimaryNavItem>
    {/snippet}
    {#if secondarySpaceUrls.length > 0}
      <Tippy
        component={PrimaryNavSpacesOverflow}
        props={overflowProps}
        params={{placement: "right", interactive: true}}>
        {@render allSpaces("")}
      </Tippy>
    {:else}
      {@render allSpaces("All Spaces")}
    {/if}
  {/each}
</div>
