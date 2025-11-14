<script lang="ts">
  import {REPORT, displayRelayUrl} from "@welshman/util"
  import AltArrowLeft from "@assets/icons/alt-arrow-left.svg?dataurl"
  import Button from "@lib/components/Button.svelte"
  import Icon from "@lib/components/Icon.svelte"
  import ModalFooter from "@lib/components/ModalFooter.svelte"
  import ReportItem from "@app/components/ReportItem.svelte"
  import {deriveEventsForUrl} from "@app/core/state"

  interface Props {
    url: string
  }

  const {url}: Props = $props()

  const reports = deriveEventsForUrl(url, [{kinds: [REPORT]}])

  const back = () => history.back()
</script>

<div class="column gap-4">
  <div class="flex min-w-0 flex-col gap-1">
    <h1 class="ellipsize whitespace-nowrap text-2xl font-bold">Reports</h1>
    <p class="ellipsize text-sm opacity-75">on {displayRelayUrl(url)}</p>
  </div>
  {#each $reports as event (event.id)}
    <ReportItem {url} {event} />
  {/each}
  <ModalFooter>
    <Button class="btn btn-link" onclick={back}>
      <Icon icon={AltArrowLeft} />
      Go back
    </Button>
  </ModalFooter>
</div>
