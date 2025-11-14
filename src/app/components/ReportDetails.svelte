<script lang="ts">
  import {REPORT} from "@welshman/util"
  import type {TrustedEvent} from "@welshman/util"
  import {deriveEvents} from "@welshman/store"
  import {repository} from "@welshman/app"
  import ModalHeader from "@lib/components/ModalHeader.svelte"
  import Button from "@lib/components/Button.svelte"
  import ReportItem from "@app/components/ReportItem.svelte"

  type Props = {
    url: string
    event: TrustedEvent
  }

  const {url, event}: Props = $props()

  const reports = deriveEvents(repository, {
    filters: [{kinds: [REPORT], "#e": [event.id]}],
  })

  const back = () => history.back()

  const onDelete = () => {
    if ($reports.length === 0) {
      back()
    }
  }
</script>

<div class="column gap-4">
  <ModalHeader>
    {#snippet title()}
      <div>Report Details</div>
    {/snippet}
    {#snippet info()}
      <div>All reports for this event are shown below.</div>
    {/snippet}
  </ModalHeader>
  {#each $reports as report (report.id)}
    <div class="card2 card2-sm bg-alt">
      <ReportItem {url} event={report} {onDelete} />
    </div>
  {/each}
  <Button class="btn btn-primary" onclick={back}>Got it</Button>
</div>
