<script lang="ts">
  import type {TrustedEvent} from "@welshman/util"
  import ArrowRight from "@assets/icons/arrow-right.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Link from "@app/components/Link.svelte"
  import RelayName from "@app/components/RelayName.svelte"
  import {getSpaceEventPath} from "@app/navigation/locations"

  type Props = {
    event: TrustedEvent
    url: string
  }

  const {event, url}: Props = $props()

  const href = $derived(getSpaceEventPath(event, url))
</script>

<Link {href} class="button button-neutral button-xs min-w-0 rounded-full">
  <Icon icon={ArrowRight} size={4} />
  <span class="truncate">View on <RelayName {url} class="text-primary" /></span>
</Link>
