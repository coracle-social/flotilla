<script lang="ts">
  import PrimaryNavItem from "@lib/components/PrimaryNavItem.svelte"
  import RelayIcon from "@app/components/RelayIcon.svelte"
  import {relays} from "@app/core"
  import {makeSpacePath, goToSpace} from "@app/routes"
  import {notifications} from "@app/notifications"

  type Props = {
    url: string
    showTooltip?: boolean
  }

  const {url, showTooltip = true}: Props = $props()

  const onClick = () => goToSpace(url)

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
