<script lang="ts">
  import BellOff from "@assets/icons/bell-off.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import SecondaryNavItem from "@lib/components/SecondaryNavItem.svelte"
  import RoomNameWithImage from "@app/components/RoomNameWithImage.svelte"
  import VoiceRoomItem from "@app/components/VoiceRoomItem.svelte"
  import {rooms} from "@app/core"
  import {RoomType, getRoomType} from "@app/rooms"
  import {deriveIsMuted} from "@app/settings"
  import {notifications} from "@app/notifications"
  import {makeRoomPath} from "@app/routes"

  type Props = {
    url: string
    h: string
    tooltip?: boolean
  }

  const {url, h, tooltip = true}: Props = $props()

  const room = $rooms.forRoom(url, h)
  const roomType = $derived(getRoomType($room))
  const path = makeRoomPath(url, h)
  const isMuted = deriveIsMuted(url, h)
  const notification = $derived($notifications.has(path))
  const roomName = $derived($room?.meta?.name() || h)
</script>

{#if roomType === RoomType.Voice}
  <VoiceRoomItem {url} {h} {notification} />
{:else}
  <SecondaryNavItem href={path} title={tooltip ? roomName : ""} {notification}>
    <RoomNameWithImage {url} {h} />
    {#if $isMuted}
      <Icon icon={BellOff} size={4} class="ml-auto opacity-50" />
    {/if}
  </SecondaryNavItem>
{/if}
