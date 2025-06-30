<script lang="ts">
  import {getTagValue} from "@welshman/util"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import AlertAdd from "@app/components/AlertAdd.svelte"
  import AlertItem from "@app/components/AlertItem.svelte"
  import {pushModal} from "@app/modal"
  import {alerts} from "@app/state"

  type Props = {
    url?: string
    channel?: string
    hideSpaceField?: boolean
  }

  const {url = "", channel = "push", hideSpaceField = false}: Props = $props()

  const startAlert = () => pushModal(AlertAdd, {url, channel, hideSpaceField})

  const filteredAlerts = $derived(
    url ? $alerts.filter(a => getTagValue("feed", a.tags)?.includes(url)) : $alerts,
  )
</script>

<div class="card2 bg-alt flex flex-col gap-6 shadow-xl">
  <div class="flex items-center justify-between">
    <strong class="flex items-center gap-3">
      <Icon icon="inbox" />
      Alerts
    </strong>
    <Button class="btn btn-primary btn-sm" onclick={startAlert}>
      <Icon icon="add-circle" />
      Add Alert
    </Button>
  </div>
  <div class="col-4">
    {#each filteredAlerts as alert (alert.event.id)}
      <AlertItem {alert} />
    {:else}
      <p class="text-center opacity-75 py-12">Nothing here yet!</p>
    {/each}
  </div>
</div>
