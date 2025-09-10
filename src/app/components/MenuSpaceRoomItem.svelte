<script lang="ts">
  import Lock from "@assets/icons/lock-keyhole.svg?dataurl"
import Hashtag from "@assets/icons/hashtag-circle.svg?dataurl"
import Icon from "@lib/components/Icon.svelte"
  import SecondaryNavItem from "@lib/components/SecondaryNavItem.svelte"
  import ChannelName from "@app/components/ChannelName.svelte"
  import {makeRoomPath} from "@app/util/routes"
  import {deriveChannel} from "@app/core/state"
  import {notifications} from "@app/util/notifications"

  interface Props {
    url: any
    room: any
    notify?: boolean
    replaceState?: boolean
  }

  const {url, room, notify = false, replaceState = false}: Props = $props()

  const path = makeRoomPath(url, room)
  const channel = deriveChannel(url, room)
</script>

<SecondaryNavItem
  href={path}
  {replaceState}
  notification={notify ? $notifications.has(path) : false}>
  {#if $channel?.closed || $channel?.private}
    <Icon icon={Lock} size={4} />
  {:else}
    <Icon icon={Hashtag} />
  {/if}
  <div class="min-w-0 overflow-hidden text-ellipsis">
    <ChannelName {url} {room} />
  </div>
</SecondaryNavItem>
