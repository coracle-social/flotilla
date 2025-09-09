<script lang="ts">
  import {getAddress, getTagValue} from "@welshman/util"
  import type {Alert} from "@app/core/state"
  import {deriveAlertStatus} from "@app/core/state"

  type Props = {
    alert: Alert
  }

  const {alert}: Props = $props()

  const status = deriveAlertStatus(getAddress(alert.event))
</script>

{#if $status}
  {@const statusText = getTagValue("status", $status.tags) || "error"}
  {#if statusText === "ok"}
    <span
      class="tooltip tooltip-left cursor-pointer rounded-full border border-solid border-base-content px-3 py-1 text-sm"
      data-tip={getTagValue("message", $status.tags)}>
      Active
    </span>
  {:else if statusText === "pending"}
    <span
      class="tooltip tooltip-left cursor-pointer rounded-full border border-solid border-base-content border-yellow-500 px-3 py-1 text-sm text-yellow-500"
      data-tip={getTagValue("message", $status.tags)}>
      Pending
    </span>
  {:else}
    <span
      class="tooltip tooltip-left cursor-pointer rounded-full border border-solid border-error px-3 py-1 text-sm text-error"
      data-tip={getTagValue("message", $status.tags)}>
      {statusText.replace("-", " ").replace(/^(.)/, x => x.toUpperCase())}
    </span>
  {/if}
{:else}
  <span
    class="tooltip tooltip-left cursor-pointer rounded-full border border-solid border-error px-3 py-1 text-sm text-error"
    data-tip="The notification server did not respond to your request.">
    Inactive
  </span>
{/if}
