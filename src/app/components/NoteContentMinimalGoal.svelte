<script lang="ts">
  import type {ComponentProps} from "svelte"
  import {sum} from "@welshman/lib"
  import type {Zap, TrustedEvent} from "@welshman/util"
  import {getTagValue, fromMsats, ZAP_RESPONSE} from "@welshman/util"
  import {deriveEventsMapped} from "@welshman/store"
  import {repository, getValidZap} from "@welshman/app"
  import Bolt from "@assets/icons/bolt.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import ContentMinimal from "@app/components/ContentMinimal.svelte"

  const props: ComponentProps<typeof ContentMinimal> = $props()

  const content = getTagValue("summary", props.event.tags)
  const fakeEvent = {content, tags: props.event.tags}

  const zaps = deriveEventsMapped<Zap>(repository, {
    filters: [{kinds: [ZAP_RESPONSE], "#e": [props.event.id]}],
    itemToEvent: item => item.response,
    eventToItem: (response: TrustedEvent) => getValidZap(response, props.event),
  })

  const goalAmount = parseInt(getTagValue("amount", props.event.tags) || "0")
  const zapAmount = $derived(fromMsats(sum($zaps.map(zap => zap.invoiceAmount))))
</script>

<div class="flex justify-between">
  <span class="text-sm">{props.event.content}</span>
  <div class="flex items-center gap-1">
    <Icon icon={Bolt} size={4} />
    {zapAmount}/{goalAmount} sats funded
  </div>
</div>
<ContentMinimal {...props} event={fakeEvent} />
