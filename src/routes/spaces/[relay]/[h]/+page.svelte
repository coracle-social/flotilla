<script lang="ts">
  import InfoCircle from "@assets/icons/info-circle.svg?dataurl"
  import Magnifier from "@assets/icons/magnifier.svg?dataurl"
  import Button from "@lib/components/Button.svelte"
  import Icon from "@lib/components/Icon.svelte"
  import SpaceBar from "@app/components/SpaceBar.svelte"
  import RoomChat from "@app/components/RoomChat.svelte"
  import RoomDetail from "@app/components/RoomDetail.svelte"
  import RoomImage from "@app/components/RoomImage.svelte"
  import RoomName from "@app/components/RoomName.svelte"
  import RoomSearch from "@app/components/RoomSearch.svelte"
  import {decodeRelay} from "@app/relays"
  import {pushModal} from "@app/modal"
  import type {PageProps} from "./$types"

  const {params}: PageProps = $props()

  const {h, relay} = params
  const url = decodeRelay(relay)

  const showRoomSearch = () => pushModal(RoomSearch, {url, h})

  const showRoomDetail = () => pushModal(RoomDetail, {url, h})
</script>

<SpaceBar>
  {#snippet leading()}
    <RoomImage {url} {h} />
  {/snippet}
  {#snippet title()}
    <RoomName {url} {h} class="block" />
  {/snippet}
  {#snippet action()}
    <Button
      class="button button-neutral button-sm button-square"
      aria-label="Search"
      onclick={showRoomSearch}>
      <Icon size={4} icon={Magnifier} />
    </Button>
    <Button
      class="button button-neutral button-sm button-square"
      aria-label="Room details"
      onclick={showRoomDetail}>
      <Icon size={4} icon={InfoCircle} />
    </Button>
  {/snippet}
</SpaceBar>

<RoomChat {url} {h} />
