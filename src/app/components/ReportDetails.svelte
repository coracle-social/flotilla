<script lang="ts">
  import {REPORT} from "@welshman/util"
  import type {TrustedEvent} from "@welshman/util"
  import ModalHeader from "@lib/components/ModalHeader.svelte"
  import ModalTitle from "@lib/components/ModalTitle.svelte"
  import ModalSubtitle from "@lib/components/ModalSubtitle.svelte"
  import Modal from "@lib/components/Modal.svelte"
  import ModalBody from "@lib/components/ModalBody.svelte"
  import Button from "@lib/components/Button.svelte"
  import ModalFooter from "@lib/components/ModalFooter.svelte"
  import ReportItem from "@app/components/ReportItem.svelte"
  import {events} from "@app/core"

  type Props = {
    url: string
    event: TrustedEvent
  }

  const {url, event}: Props = $props()

  const reports = $events.byId([{kinds: [REPORT], "#e": [event.id]}]).$

  const back = () => history.back()

  const onResolved = () => {
    if ($reports.size === 0) {
      back()
    }
  }
</script>

<Modal>
  <ModalBody>
    <ModalHeader>
      <ModalTitle>Report Details</ModalTitle>
      <ModalSubtitle>All reports for this event are shown below.</ModalSubtitle>
    </ModalHeader>
    {#each $reports.values() as report (report.id)}
      <ReportItem {url} event={report} {onResolved} />
    {/each}
  </ModalBody>
  <ModalFooter>
    <Button class="button button-primary" onclick={back}>Got it</Button>
  </ModalFooter>
</Modal>
