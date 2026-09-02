<script lang="ts">
  import {goto} from "$app/navigation"
  import {page} from "$app/stores"
  import PrimaryNavItem from "@lib/components/PrimaryNavItem.svelte"
  import RelayIcon from "@app/components/RelayIcon.svelte"
  import {relays} from "@app/core"
  import {makeSpacePath, makeSpaceEntryPath} from "@app/routes"
  import {notifications} from "@app/notifications"

  type Props = {
    url: string
    showTooltip?: boolean
  }

  const {url, showTooltip = true}: Props = $props()

  const onClick = () => {
    const entryPath = makeSpaceEntryPath(url)

    goto(entryPath, {replaceState: entryPath === $page.url.pathname})
  }

  const path = makeSpacePath(url)

  const display = $relays.display(url).$
</script>

<PrimaryNavItem
  href={path}
  onclick={onClick}
  title={showTooltip ? $display : ""}
  notification={$notifications.has(path)}>
  <RelayIcon {url} size={10} />
</PrimaryNavItem>
