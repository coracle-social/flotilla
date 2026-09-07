<script lang="ts">
  import {MESSAGE} from "@welshman/util"
  import Modal from "@lib/components/Modal.svelte"
  import ModalHeader from "@lib/components/ModalHeader.svelte"
  import ModalTitle from "@lib/components/ModalTitle.svelte"
  import ModalSubtitle from "@lib/components/ModalSubtitle.svelte"
  import RoomName from "@app/components/RoomName.svelte"
  import SearchBody from "@app/components/SearchBody.svelte"
  import {CONTENT_KINDS} from "@app/content"
  import {deriveRoomMembers} from "@app/rooms"

  type Props = {
    url: string
    h: string
  }

  const {url, h}: Props = $props()

  const filter = {kinds: [MESSAGE, ...CONTENT_KINDS], "#h": [h]}

  const members = deriveRoomMembers(url, h)
</script>

<Modal class="flex flex-col gap-2">
  <ModalHeader>
    <ModalTitle>Search</ModalTitle>
    <ModalSubtitle>
      in <RoomName {url} {h} class="text-primary" />
    </ModalSubtitle>
  </ModalHeader>
  <SearchBody {url} {filter} placeholder="Search this room..." relays={[url]} members={$members} />
</Modal>
