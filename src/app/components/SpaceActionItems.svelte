<script lang="ts">
  import AltArrowLeft from "@assets/icons/alt-arrow-left.svg?dataurl"
  import Button from "@lib/components/Button.svelte"
  import Icon from "@lib/components/Icon.svelte"
  import Modal from "@lib/components/Modal.svelte"
  import ModalBody from "@lib/components/ModalBody.svelte"
  import ModalHeader from "@lib/components/ModalHeader.svelte"
  import ModalTitle from "@lib/components/ModalTitle.svelte"
  import ModalSubtitle from "@lib/components/ModalSubtitle.svelte"
  import ModalFooter from "@lib/components/ModalFooter.svelte"
  import ReportItem from "@app/components/ReportItem.svelte"
  import RoomJoinItem from "@app/components/RoomJoinItem.svelte"
  import RelayName from "@app/components/RelayName.svelte"
  import {REPORT} from "@welshman/util"
  import {deriveSpaceActionItems} from "@app/features/actionItems"

  type Props = {
    url: string
  }

  const {url}: Props = $props()

  const actionItems = deriveSpaceActionItems(url)

  const back = () => history.back()

  const onResolved = () => {
    if ($actionItems.length === 0) {
      back()
    }
  }
</script>

<Modal>
  <ModalBody>
    <ModalHeader>
      <ModalTitle>Action Items</ModalTitle>
      <ModalSubtitle>on <RelayName {url} class="text-primary" /></ModalSubtitle>
    </ModalHeader>
    <div class="flex flex-col gap-2">
      {#each $actionItems as event (event.id)}
        {#if event.kind === REPORT}
          <ReportItem {url} {event} {onResolved} />
        {:else}
          <RoomJoinItem {url} {event} {onResolved} />
        {/if}
      {:else}
        <p class="py-12 text-center">No action items found.</p>
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
