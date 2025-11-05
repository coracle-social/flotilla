<script lang="ts">
  import {displayRelayUrl} from "@welshman/util"
  import PrimaryNavItem from "@lib/components/PrimaryNavItem.svelte"
  import SpaceAvatar from "@app/components/SpaceAvatar.svelte"
  import {makeSpacePath, goToSpace} from "@app/util/routes"
  import {notifications} from "@app/util/notifications"

  const {url} = $props()

  const onClick = () => goToSpace(url)
</script>

<PrimaryNavItem
  onclick={onClick}
  title={displayRelayUrl(url)}
  class="tooltip-right"
  notification={$notifications.has(makeSpacePath(url))}>
  <SpaceAvatar {url} />
</PrimaryNavItem>
