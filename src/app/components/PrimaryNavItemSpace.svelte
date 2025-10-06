<script lang="ts">
  import {goto} from "$app/navigation"
  import {displayRelayUrl} from "@welshman/util"
  import PrimaryNavItem from "@lib/components/PrimaryNavItem.svelte"
  import SpaceAvatar from "@app/components/SpaceAvatar.svelte"
  import {encodeRelay} from "@app/core/state"
  import {makeSpacePath} from "@app/util/routes"
  import {lastPageBySpaceUrl} from "@app/util/history"
  import {notifications} from "@app/util/notifications"

  const {url} = $props()

  const path = makeSpacePath(url)

  const onClick = () => goto(lastPageBySpaceUrl.get(encodeRelay(url)) || path)
</script>

<PrimaryNavItem
  onclick={onClick}
  title={displayRelayUrl(url)}
  class="tooltip-right"
  notification={$notifications.has(path)}>
  <SpaceAvatar {url} />
</PrimaryNavItem>
