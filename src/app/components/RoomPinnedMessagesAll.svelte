<script lang="ts">
  import type {TrustedEvent} from "@welshman/util"
  import Pin from "@assets/icons/pin.svg?dataurl"
  import AltArrowLeft from "@assets/icons/alt-arrow-left.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import Modal from "@lib/components/Modal.svelte"
  import ModalBody from "@lib/components/ModalBody.svelte"
  import ModalHeader from "@lib/components/ModalHeader.svelte"
  import ModalTitle from "@lib/components/ModalTitle.svelte"
  import ModalSubtitle from "@lib/components/ModalSubtitle.svelte"
  import ModalFooter from "@lib/components/ModalFooter.svelte"
  import ProfileCircle from "@app/components/ProfileCircle.svelte"
  import ProfileName from "@app/components/ProfileName.svelte"
  import RoomItemContent from "@app/components/RoomItemContent.svelte"
  import RoomName from "@app/components/RoomName.svelte"
  import {deriveUserIsRoomAdmin} from "@app/features/rooms"
  import {deriveRoomPinnedEvents, toggleRoomPin} from "@app/features/roomPins"
  import {goToEvent} from "@app/ui/routes"

  type Props = {
    url: string
    h: string
  }

  const {url, h}: Props = $props()

  const pinnedEvents = deriveRoomPinnedEvents(url, h)
  const userIsAdmin = deriveUserIsRoomAdmin(url, h)

  const back = () => history.back()

  const jumpToMessage = (event: TrustedEvent) => {
    back()
    goToEvent(event)
  }
</script>

<Modal>
  <ModalBody>
    <ModalHeader>
      <ModalTitle>Pinned Messages</ModalTitle>
      <ModalSubtitle>
        in <RoomName {url} {h} class="text-primary" />
      </ModalSubtitle>
    </ModalHeader>
    <div class="flex flex-col gap-2">
      {#each $pinnedEvents as event (event.id)}
        {@const onUnpin = () => toggleRoomPin(url, h, event)}
        {@const onJump = () => jumpToMessage(event)}
        <div class="card card-sm flex flex-col gap-3 p-4">
          <div class="flex items-start gap-3">
            <ProfileCircle pubkey={event.pubkey} {url} size={6} />
            <div class="min-w-0 flex-1">
              <p class="text-content-muted text-xs font-bold tracking-wide uppercase">
                Pinned message
              </p>
              <p class="truncate text-sm">
                <ProfileName pubkey={event.pubkey} {url} />
              </p>
            </div>
            <Icon icon={Pin} size={4} class="text-primary shrink-0 opacity-70" />
          </div>
          <RoomItemContent {url} {event} />
          <div class="flex flex-wrap items-center justify-end gap-2">
            {#if $userIsAdmin}
              <Button class="button button-link button-sm" onclick={onUnpin}>Unpin</Button>
            {/if}
            <Button class="button button-primary button-sm" onclick={onJump}>
              Jump to message
            </Button>
          </div>
        </div>
      {:else}
        <div class="card card-sm p-4">
          <p class="text-content-muted text-center text-sm">No pinned messages.</p>
        </div>
      {/each}
    </div>
  </ModalBody>
  <ModalFooter>
    <Button class="button button-link" onclick={back}>
      <Icon icon={AltArrowLeft} />
      Go back
    </Button>
  </ModalFooter>
</Modal>
