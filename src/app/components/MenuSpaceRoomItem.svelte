<script lang="ts">
  import SecondaryNavItem from "@lib/components/SecondaryNavItem.svelte"
  import RoomNameWithImage from "@app/components/RoomNameWithImage.svelte"
  import {makeRoomPath} from "@app/util/routes"
  import {notifications} from "@app/util/notifications"

  interface Props {
    url: any
    h: any
    notify?: boolean
    replaceState?: boolean
  }

  const {url, h, notify = false, replaceState = false}: Props = $props()

  const path = makeRoomPath(url, h)
</script>

<SecondaryNavItem
  href={path}
  {replaceState}
  notification={notify ? $notifications.has(path) : false}>
  <RoomNameWithImage {url} {h} />
</SecondaryNavItem>
