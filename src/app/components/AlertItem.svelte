<script lang="ts">
  import {parseJson} from "@welshman/lib"
  import {displayFeeds} from "@welshman/feeds"
  import {getTagValue, getTagValues} from "@welshman/util"
  import TrashBin2 from "@assets/icons/trash-bin-2.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import AlertDelete from "@app/components/AlertDelete.svelte"
  import AlertStatus from "@app/components/AlertStatus.svelte"
  import type {Alert} from "@app/core/state"
  import {pushModal} from "@app/util/modal"

  type Props = {
    alert: Alert
  }

  const {alert}: Props = $props()

  const cron = $derived(getTagValue("cron", alert.tags))
  const channel = $derived(getTagValue("channel", alert.tags))
  const feeds = $derived(getTagValues("feed", alert.tags))
  const description = $derived(
    getTagValue("description", alert.tags) ||
      [
        `${cron?.endsWith("1") ? "Weekly" : "Daily"} alert for events`,
        displayFeeds(feeds.map(parseJson)),
        `sent via ${channel}.`,
      ].join(" "),
  )

  const startDelete = () => pushModal(AlertDelete, {alert})
</script>

<div class="flex items-start justify-between gap-4">
  <div class="flex items-start gap-4">
    <Button class="py-1" onclick={startDelete}>
      <Icon icon={TrashBin2} />
    </Button>
    <div class="flex-inline gap-1">{description}</div>
  </div>
  <AlertStatus {alert} />
</div>
