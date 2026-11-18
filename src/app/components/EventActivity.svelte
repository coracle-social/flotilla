<script lang="ts">
  import {onMount} from "svelte"
  import {derived} from "svelte/store"
  import {filter, max, spec, formatTimestampRelative} from "@welshman/lib"
  import {COMMENT} from "@welshman/util"
  import type {TrustedEvent} from "@welshman/util"
  import Reply from "@assets/icons/reply-2.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import {events} from "@app/core/plugins"
  import {getRepliesFilters, loadReplies} from "@app/tools/interactions/interactions"

  type Props = {
    event: TrustedEvent
    url?: string
    size?: "xs" | "sm"
    hideLastActive?: boolean
  }

  const {event, url, size = "xs", hideLastActive}: Props = $props()

  const buttonClass = `button button-neutral button-${size} rounded-full`

  const related = $events.desc(getRepliesFilters([event])).$
  const replies = derived(related, $related => filter(spec({kind: COMMENT}), $related))
  const lastActive = $derived(max([...$replies, event].map(e => e.created_at)))

  onMount(() => loadReplies(event, url))
</script>

<div class="flex-inline {buttonClass} gap-1">
  <Icon icon={Reply} />
  <span>{$replies.length} {$replies.length === 1 ? "reply" : "replies"}</span>
</div>
{#if !hideLastActive}
  <div class={buttonClass}>
    Active {formatTimestampRelative(lastActive)}
  </div>
{/if}
