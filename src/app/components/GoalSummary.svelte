<script lang="ts">
  import {now, DAY, uniq, sum} from "@welshman/lib"
  import type {Zap, TrustedEvent} from "@welshman/util"
  import {getTagValue, fromMsats, ZAP_RESPONSE} from "@welshman/util"
  import {deriveEventsMapped} from "@welshman/store"
  import {repository, getValidZap} from "@welshman/app"
  import Icon from "@lib/components/Icon.svelte"
  import ZapButton from "@app/components/ZapButton.svelte"

  type Props = {
    url: string
    event: TrustedEvent
  }

  const {url, event}: Props = $props()

  const zaps = deriveEventsMapped<Zap>(repository, {
    filters: [{kinds: [ZAP_RESPONSE], "#e": [event.id]}],
    itemToEvent: item => item.response,
    eventToItem: (response: TrustedEvent) => getValidZap(response, event),
  })

  const goalAmount = parseInt(getTagValue("amount", event.tags) || "0")
  const zapAmount = $derived(fromMsats(sum($zaps.map(zap => zap.invoiceAmount))))
  const contributorsCount = $derived(uniq($zaps.map(zap => zap.request.pubkey)).length)
  const daysOld = Math.ceil((now() - event.created_at) / DAY)
</script>

<div class="card2 bg-alt flex flex-col gap-8">
  <div class="flex gap-8">
    <div>
      <p class="text-xl text-primary">{zapAmount} sats</p>
      <p class="text-sm opacity-75">funded of {goalAmount} sats</p>
    </div>
    <div>
      <p class="text-xl">{contributorsCount}</p>
      <p class="text-sm opacity-75">{contributorsCount === 1 ? "contributor" : "contributors"}</p>
    </div>
    <div>
      <p class="text-xl">{daysOld}</p>
      <p class="text-sm opacity-75">{daysOld === 1 ? "day" : "days"} old</p>
    </div>
  </div>
  <progress class="progress progress-primary" value={zapAmount} max={goalAmount}></progress>
  <ZapButton {url} {event} class="btn btn-primary lg:m-auto lg:px-20">
    <Icon icon="bolt" />
    Contribute to this goal
  </ZapButton>
</div>
