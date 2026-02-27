<script lang="ts">
  import VolumeCross from "@assets/icons/volume-cross.svg?dataurl"
  import VolumeLoud from "@assets/icons/volume-loud.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import SecondaryNavItem from "@lib/components/SecondaryNavItem.svelte"
  import RoomNameWithImage from "@app/components/RoomNameWithImage.svelte"
  import {notifications} from "@app/util/notifications"
  import {makeRoomPath} from "@app/util/routes"
  import {deriveShouldNotify} from "@app/core/state"

  interface Props {
    url: any
    h: any
    notify?: boolean
    replaceState?: boolean
  }

  const {url, h, notify = false, replaceState = false}: Props = $props()

  const path = makeRoomPath(url, h)
  const shouldNotifyForSpace = deriveShouldNotify(url)
  const shouldNotifyForRoom = deriveShouldNotify(url, h)
  const showDifferenceIcon = $derived($shouldNotifyForRoom !== $shouldNotifyForSpace)
</script>

<SecondaryNavItem
  href={path}
  {replaceState}
  notification={notify ? $notifications.has(path) : false}>
  <RoomNameWithImage {url} {h} />
  {#if showDifferenceIcon}
    <Icon icon={$shouldNotifyForRoom ? VolumeLoud : VolumeCross} size={4} class="opacity-50" />
  {/if}
</SecondaryNavItem>
