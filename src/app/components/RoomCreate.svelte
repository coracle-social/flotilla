<script lang="ts">
  import {goto} from "$app/navigation"
  import type {RoomMeta} from "@welshman/util"
  import {displayRelayUrl} from "@welshman/util"
  import AltArrowLeft from "@assets/icons/alt-arrow-left.svg?dataurl"
  import AltArrowRight from "@assets/icons/alt-arrow-right.svg?dataurl"
  import Spinner from "@lib/components/Spinner.svelte"
  import Button from "@lib/components/Button.svelte"
  import Icon from "@lib/components/Icon.svelte"
  import ModalHeader from "@lib/components/ModalHeader.svelte"
  import ModalFooter from "@lib/components/ModalFooter.svelte"
  import RoomForm from "@app/components/RoomForm.svelte"
  import {makeSpacePath} from "@app/util/routes"

  const {url} = $props()

  const back = () => history.back()

  const onsubmit = (room: RoomMeta) => goto(makeSpacePath(url, room.h))
</script>

<RoomForm {url} {onsubmit}>
  {#snippet header()}
    <ModalHeader>
      {#snippet title()}
        <div>Create a Room</div>
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
      <Button type="submit" class="btn btn-primary" disabled={loading}>
        <Spinner {loading}>Create Room</Spinner>
        <Icon icon={AltArrowRight} />
      </Button>
    </ModalFooter>
  {/snippet}
</RoomForm>
