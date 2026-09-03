<script lang="ts">
  import {derived} from "svelte/store"
  import {filter, max, spec, formatTimestampRelative} from "@welshman/lib"
  import {COMMENT} from "@welshman/util"
  import type {TrustedEvent} from "@welshman/util"
  import Reply from "@assets/icons/reply-2.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import type {FeedContext} from "@app/feeds"

  // hideLastActive: redundant next to a detail page's own comments below.
  const {
    event,
    context,
    size = "xs",
    hideLastActive,
  }: {
    event: TrustedEvent
    context: FeedContext
    size?: "xs" | "sm"
    hideLastActive?: boolean
  } = $props()

  const buttonClass = `button button-neutral button-${size} rounded-full`

  const related = context.related(event)
  const replies = derived(related, $related => filter(spec({kind: COMMENT}), $related))
  const lastActive = $derived(max([...$replies, event].map(e => e.created_at)))
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
