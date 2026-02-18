<script lang="ts">
  import {onMount} from "svelte"
  import {max, gt, formatTimestampRelative} from "@welshman/lib"
  import {COMMENT} from "@welshman/util"
  import {load} from "@welshman/net"
  import {deriveArray, deriveEventsById} from "@welshman/store"
  import type {TrustedEvent} from "@welshman/util"
  import {repository} from "@welshman/app"
  import {deriveChecked} from "@app/util/notifications"
  import Reply from "@assets/icons/reply-2.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"

  const {url, path, event}: {url: string; path: string; event: TrustedEvent} = $props()

  const checked = deriveChecked(path)
  const filters = [{kinds: [COMMENT], "#E": [event.id]}]
  const replies = deriveArray(deriveEventsById({repository, filters}))
  const lastActive = $derived(max([...$replies, event].map(e => e.created_at)))

  onMount(() => {
    load({relays: [url], filters})
  })
</script>

<div class="flex-inline btn btn-neutral btn-xs gap-1 rounded-full">
  <Icon icon={Reply} />
  <span>{$replies.length} {$replies.length === 1 ? "reply" : "replies"}</span>
</div>
<div class="btn btn-neutral btn-xs relative rounded-full">
  {#if gt(lastActive, $checked)}
    <div class="h-2 w-2 rounded-full bg-primary"></div>
  {/if}
  Active {formatTimestampRelative(lastActive)}
</div>
