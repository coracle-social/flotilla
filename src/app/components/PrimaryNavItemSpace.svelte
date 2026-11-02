<script lang="ts">
  import {page} from "$app/stores"
  import PrimaryNavItem from "@lib/components/PrimaryNavItem.svelte"
  import RelayIcon from "@app/components/RelayIcon.svelte"
  import {relays} from "@app/core/plugins"
  import {navigate} from "@app/navigation/navigate"
  import * as pages from "@app/navigation/pages"
  import {hasSpacePage, makeSpaceEntryPath} from "@app/navigation/history"
  import {notifications} from "@app/features/notifications"

  type Props = {
    url: string
    showTooltip?: boolean
  }

  const {url, showTooltip = true}: Props = $props()

  const onClick = () => {
    const entryPath = makeSpaceEntryPath(url)

    navigate(entryPath, {
      keepModal: !hasSpacePage(url),
      replaceState: entryPath === $page.url.pathname,
    })
  }

  const path = pages.space.path({url})

  const display = $relays.display(url).$
</script>

<PrimaryNavItem
  href={path}
  onclick={onClick}
  title={showTooltip ? $display : ""}
  notification={$notifications.has(path)}>
  <RelayIcon {url} size={10} />
</PrimaryNavItem>
