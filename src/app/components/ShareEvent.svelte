<script lang="ts">
  import type {TrustedEvent} from "@welshman/util"
  import {preventDefault} from "@lib/html"
  import AltArrowLeft from "@assets/icons/alt-arrow-left.svg?dataurl"
  import AltArrowRight from "@assets/icons/alt-arrow-right.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import ModalHeader from "@lib/components/ModalHeader.svelte"
  import ModalTitle from "@lib/components/ModalTitle.svelte"
  import ModalSubtitle from "@lib/components/ModalSubtitle.svelte"
  import ModalFooter from "@lib/components/ModalFooter.svelte"
  import Modal from "@lib/components/Modal.svelte"
  import ModalBody from "@lib/components/ModalBody.svelte"
  import RoomNameWithImage from "@app/components/RoomNameWithImage.svelte"
  import {makeRoomPath} from "@app/routes"
  import {shareTo} from "@app/share"
  import {rooms} from "@app/core"

  type Props = {
    url: string
    noun: string
    event: TrustedEvent
  }

  const {url, noun, event}: Props = $props()

  const spaceRooms = $rooms.forUrl(url).$

  const back = () => history.back()

  const onSubmit = () => {
    shareTo(makeRoomPath(url, selection), {type: "event", value: event})
  }

  const toggleRoom = (h: string) => {
    selection = h === selection ? "" : h
  }

  let selection = $state("")
</script>

<Modal tag="form" onsubmit={preventDefault(onSubmit)}>
  <ModalBody>
    <ModalHeader>
      <ModalTitle>Share {noun}</ModalTitle>
      <ModalSubtitle>Which room would you like to share this event to?</ModalSubtitle>
    </ModalHeader>
    <div class="grid grid-cols-2 gap-2">
      {#each $spaceRooms as room (room.h)}
        <Button
          type="button"
          class="flex justify-center button {selection === room.h
            ? 'button-primary'
            : 'button-neutral'}"
          onclick={() => toggleRoom(room.h)}>
          <RoomNameWithImage {url} h={room.h} />
        </Button>
      {/each}
    </div>
  </ModalBody>
  <ModalFooter>
    <Button class="button button-link" onclick={back}>
      <Icon icon={AltArrowLeft} />
      Go back
    </Button>
    <Button type="submit" class="button button-primary" disabled={!selection}>
      Share {noun}
      <Icon icon={AltArrowRight} />
    </Button>
  </ModalFooter>
</Modal>
