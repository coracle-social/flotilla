<script lang="ts">
  import {navigate} from "@app/modal"
  import {displayRelayUrl} from "@welshman/util"
  import type {RoomMeta} from "@welshman/app"
  import AltArrowLeft from "@assets/icons/alt-arrow-left.svg?dataurl"
  import AltArrowRight from "@assets/icons/alt-arrow-right.svg?dataurl"
  import Spinner from "@lib/components/Spinner.svelte"
  import Button from "@lib/components/Button.svelte"
  import Icon from "@lib/components/Icon.svelte"
  import ModalHeader from "@lib/components/ModalHeader.svelte"
  import ModalTitle from "@lib/components/ModalTitle.svelte"
  import ModalSubtitle from "@lib/components/ModalSubtitle.svelte"
  import ModalFooter from "@lib/components/ModalFooter.svelte"
  import RoomForm from "@app/components/RoomForm.svelte"
  import {makeSpacePath} from "@app/routes"

  type Props = {
    url: string
  }

  const {url}: Props = $props()

  const back = () => history.back()

  const onsubmit = (room: RoomMeta) => navigate(makeSpacePath(url, room.h))
</script>

<RoomForm {url} {onsubmit}>
  {#snippet header()}
    <ModalHeader>
      <ModalTitle>Create a Room</ModalTitle>
      <ModalSubtitle>
        On <span class="text-primary">{displayRelayUrl(url)}</span>
      </ModalSubtitle>
    </ModalHeader>
  {/snippet}
  {#snippet footer({loading})}
    <ModalFooter>
      <Button class="button button-link" onclick={back}>
        <Icon icon={AltArrowLeft} />
        Go back
      </Button>
      <Button type="submit" class="button button-primary" disabled={loading}>
        <Spinner {loading}>Create Room</Spinner>
        <Icon icon={AltArrowRight} />
      </Button>
    </ModalFooter>
  {/snippet}
</RoomForm>
