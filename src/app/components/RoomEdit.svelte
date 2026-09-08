<script lang="ts">
  import {navigate} from "@app/modal"
  import {displayRelayUrl} from "@welshman/util"
  import type {RoomMeta} from "@welshman/app"
  import AltArrowLeft from "@assets/icons/alt-arrow-left.svg?dataurl"
  import Spinner from "@lib/components/Spinner.svelte"
  import Button from "@lib/components/Button.svelte"
  import Icon from "@lib/components/Icon.svelte"
  import ModalHeader from "@lib/components/ModalHeader.svelte"
  import ModalTitle from "@lib/components/ModalTitle.svelte"
  import ModalSubtitle from "@lib/components/ModalSubtitle.svelte"
  import ModalFooter from "@lib/components/ModalFooter.svelte"
  import RoomForm from "@app/components/RoomForm.svelte"
  import {rooms} from "@app/core"
  import {makeSpacePath} from "@app/routes"

  type Props = {
    url: string
    h: string
  }

  const {url, h}: Props = $props()

  const room = $rooms.forRoom(url, h)
  const meta = $derived($room?.meta)

  const initialValues: RoomMeta = $derived({
    h,
    name: meta?.name(),
    about: meta?.about(),
    picture: meta?.picture(),
    pictureMeta: meta?.pictureMeta(),
    isClosed: meta?.isClosed(),
    isHidden: meta?.isHidden(),
    isPrivate: meta?.isPrivate(),
    isRestricted: meta?.isRestricted(),
    livekit: meta?.hasLivekit(),
  })

  const back = () => history.back()

  const onsubmit = () => navigate(makeSpacePath(url, h))
</script>

<RoomForm {url} {onsubmit} {initialValues}>
  {#snippet header()}
    <ModalHeader>
      <ModalTitle>Edit a Room</ModalTitle>
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
        <Spinner {loading}>Save Changes</Spinner>
      </Button>
    </ModalFooter>
  {/snippet}
</RoomForm>
