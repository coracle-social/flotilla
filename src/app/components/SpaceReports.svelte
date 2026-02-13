<script lang="ts">
  import {REPORT} from "@welshman/util"
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
  import RelayName from "@app/components/RelayName.svelte"
  import {deriveEventsForUrl} from "@app/core/state"

  interface Props {
    url: string
  }

  const {url}: Props = $props()

  const reports = deriveEventsForUrl(url, [{kinds: [REPORT]}])

  const back = () => history.back()

  const onDelete = () => {
    if ($reports.length === 0) {
      back()
    }
  }
</script>

<Modal>
  <ModalBody>
    <ModalHeader>
      <ModalTitle>Reports</ModalTitle>
      <ModalSubtitle>on <RelayName {url} class="text-primary" /></ModalSubtitle>
    </ModalHeader>
    <div class="flex flex-col gap-2">
      {#each $reports as event (event.id)}
        <ReportItem {url} {event} {onDelete} />
      {:else}
        <p class="py-12 text-center">No reports found.</p>
      {/each}
    </div>
  </ModalBody>
  <ModalFooter>
    <Button class="btn btn-link" onclick={back}>
      <Icon icon={AltArrowLeft} />
      Go back
    </Button>
  </ModalFooter>
</Modal>
