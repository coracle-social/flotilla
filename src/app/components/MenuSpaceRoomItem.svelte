<script lang="ts">
  import SecondaryNavItem from "@lib/components/SecondaryNavItem.svelte"
  import ChannelNameWithImage from "@app/components/ChannelNameWithImage.svelte"
  import {makeRoomPath} from "@app/util/routes"
  import {notifications} from "@app/util/notifications"

  interface Props {
    url: any
    room: any
    notify?: boolean
    replaceState?: boolean
  }

  const {url, room, notify = false, replaceState = false}: Props = $props()

  const path = makeRoomPath(url, room)
</script>

<SecondaryNavItem
  href={path}
  {replaceState}
  notification={notify ? $notifications.has(path) : false}>
  <ChannelNameWithImage {url} {room} />
</SecondaryNavItem>
