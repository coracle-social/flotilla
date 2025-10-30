<script lang="ts">
  import {goto} from "$app/navigation"
  import type {RoomMeta} from "@welshman/util"
  import {displayRelayUrl, makeRoomMeta, readRoomMeta} from "@welshman/util"
  import {deleteRoom, waitForThunkError, repository} from "@welshman/app"
  import TrashBin2 from "@assets/icons/trash-bin-2.svg?dataurl"
  import AltArrowLeft from "@assets/icons/alt-arrow-left.svg?dataurl"
  import Spinner from "@lib/components/Spinner.svelte"
  import Button from "@lib/components/Button.svelte"
  import Icon from "@lib/components/Icon.svelte"
  import Confirm from "@lib/components/Confirm.svelte"
  import ModalHeader from "@lib/components/ModalHeader.svelte"
  import ModalFooter from "@lib/components/ModalFooter.svelte"
  import RoomForm from "@app/components/RoomForm.svelte"
  import {deriveChannel} from "@app/core/state"
  import {makeSpacePath} from "@app/util/routes"
  import {pushModal} from "@app/util/modal"
  import {pushToast} from "@app/util/toast"

  type Props = {
    url: string
    h: string
  }

  const {url, h}: Props = $props()

  const channel = deriveChannel(url, h)
  const initialValues = $channel ? readRoomMeta($channel.event) : makeRoomMeta({h})

  const back = () => history.back()

  const onsubmit = (room: RoomMeta) => goto(makeSpacePath(url, room.h))

  const startDelete = () =>
    pushModal(Confirm, {
      title: "Are you sure you want to delete this room?",
      message:
        "This room will no longer be accessible to space members, and all messages posted to it will be deleted.",
      confirm: async () => {
        const thunk = deleteRoom(url, makeRoomMeta({h}))
        const message = await waitForThunkError(thunk)

        if (message) {
          repository.removeEvent(thunk.event.id)
          pushToast({theme: "error", message})
        } else {
          goto(makeSpacePath(url))
        }
      },
    })
</script>

<RoomForm {url} {onsubmit} {initialValues}>
  {#snippet header()}
    <ModalHeader>
      {#snippet title()}
        <div>Edit a Room</div>
      {/snippet}
      {#snippet info()}
        <div>
          On <span class="text-primary">{displayRelayUrl(url)}</span>
        </div>
      {/snippet}
    </ModalHeader>
  {/snippet}
  {#snippet footer({loading})}
    <ModalFooter>
      <Button class="btn btn-link" onclick={back}>
        <Icon icon={AltArrowLeft} />
        Go back
      </Button>
      <div class="flex gap-2">
        <Button class="btn btn-outline btn-error" onclick={startDelete}>
          <Icon icon={TrashBin2} />
          <span class="hidden md:inline">Delete Room</span>
        </Button>
        <Button type="submit" class="btn btn-primary" disabled={loading}>
          <Spinner {loading}>Save Changes</Spinner>
        </Button>
      </div>
    </ModalFooter>
  {/snippet}
</RoomForm>
