<script lang="ts">
  import VolumeCross from "@assets/icons/volume-cross.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import SecondaryNavItem from "@lib/components/SecondaryNavItem.svelte"
  import RoomNameWithImage from "@app/components/RoomNameWithImage.svelte"
  import {makeRoomPath} from "@app/util/routes"
  import {notifications} from "@app/util/notifications"
  import {userSettingsValues, makeRoomId} from "@app/core/state"

  interface Props {
    url: any
    h: any
    notify?: boolean
    replaceState?: boolean
  }

  const {url, h, notify = false, replaceState = false}: Props = $props()

  const id = makeRoomId(url, h)
  const path = makeRoomPath(url, h)
</script>

<SecondaryNavItem
  href={path}
  {replaceState}
  notification={notify ? $notifications.has(path) : false}>
  <RoomNameWithImage {url} {h} />
  {#if $userSettingsValues.muted_rooms.includes(id)}
    <Icon icon={VolumeCross} size={4} class="opacity-50" />
  {/if}
</SecondaryNavItem>
