<script lang="ts">
  import cx from "classnames"
  import {identity} from "@welshman/lib"
  import ImageIcon from "@lib/components/ImageIcon.svelte"
  import Divider from "@lib/components/Divider.svelte"
  import PrimaryNavItem from "@lib/components/PrimaryNavItem.svelte"
  import DragList from "@lib/components/DragList.svelte"
  import PrimaryNavItemSpace from "@app/components/PrimaryNavItemSpace.svelte"
  import {homeNotificationsUnread} from "@app/ui/notifications"
  import {reorderSpaceUrls, userSpaceUrls} from "@app/features/rooms"
  import {PLATFORM_RELAYS, PLATFORM_LOGO} from "@app/core/env"

  const fadeSize = 24

  let element: HTMLElement | undefined = $state()
  let hiddenAbove = $state(0)
  let hiddenBelow = $state(0)

  const measure = () => {
    if (element) {
      hiddenAbove = element.scrollTop
      hiddenBelow = element.scrollHeight - element.clientHeight - element.scrollTop
    }
  }

  // Nothing fires on a change of scroll height, which joining or leaving a space causes.
  $effect(() => {
    const observer = new ResizeObserver(measure)

    if (element) {
      observer.observe(element)

      for (const child of element.children) {
        observer.observe(child)
      }
    }

    return () => observer.disconnect()
  })
</script>

<div class={cx("flex min-h-0 flex-col items-center", {"flex-1": PLATFORM_RELAYS.length === 0})}>
  {#each PLATFORM_RELAYS as url (url)}
    <PrimaryNavItemSpace {url} />
  {:else}
    <PrimaryNavItem title="Home" href="/home" notification={$homeNotificationsUnread}>
      <ImageIcon alt="Home" src={PLATFORM_LOGO} class="rounded-full" size={10} />
    </PrimaryNavItem>
    <Divider class="w-full" />
    <div
      bind:this={element}
      onscroll={measure}
      class="primary-nav__spaces mb-2"
      style:--fade-top="{Math.min(hiddenAbove, fadeSize)}px"
      style:--fade-bottom="{Math.min(hiddenBelow, fadeSize)}px">
      <DragList
        class="flex flex-col items-center"
        items={$userSpaceUrls}
        getKey={identity}
        onReorder={reorderSpaceUrls}>
        {#snippet item(url)}
          <PrimaryNavItemSpace {url} />
        {/snippet}
      </DragList>
    </div>
  {/each}
</div>
