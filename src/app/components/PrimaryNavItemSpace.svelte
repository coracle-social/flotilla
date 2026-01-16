<script lang="ts">
  import {displayRelayUrl} from "@welshman/util"
  import PrimaryNavItem from "@lib/components/PrimaryNavItem.svelte"
  import RelayIcon from "@app/components/RelayIcon.svelte"
  import {makeSpacePath, goToSpace} from "@app/util/routes"
  import {notifications} from "@app/util/notifications"

  type Props = {
    url: string
  }

  const {url}: Props = $props()

  const onClick = () => goToSpace(url)
</script>

<PrimaryNavItem
  onclick={onClick}
  title={displayRelayUrl(url)}
  class="tooltip-right"
  notification={$notifications.has(makeSpacePath(url))}>
  <RelayIcon {url} size={10} class="rounded-full" />
</PrimaryNavItem>
