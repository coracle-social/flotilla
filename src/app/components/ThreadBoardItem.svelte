<script lang="ts">
  import {navigate} from "@app/modal"
  import {derived} from "svelte/store"
  import {filter, formatTimestamp, max, spec} from "@welshman/lib"
  import type {TrustedEvent} from "@welshman/util"
  import {COMMENT, tagSpec, tagValue} from "@welshman/util"
  import Link from "@lib/components/Link.svelte"
  import Cv from "@lib/components/Cv.svelte"
  import ProfileCircle from "@app/components/ProfileCircle.svelte"
  import ProfileName from "@app/components/ProfileName.svelte"
  import UnreadDot from "@app/components/UnreadDot.svelte"
  import type {FeedContext} from "@app/feeds"
  import {makeThreadPath} from "@app/routes"

  type Props = {
    url: string
    event: TrustedEvent
    context: FeedContext
    stacked?: boolean
  }

  const {url, event, context, stacked = false}: Props = $props()

  const related = context.related(event)
  const replies = derived(related, $related => filter(spec({kind: COMMENT}), $related))
  const replyCount = $derived($replies.length)
  const lastActive = $derived(max([...$replies, event].map(e => e.created_at)))
  const title = tagValue(tagSpec("title"), event.tags)
  const path = makeThreadPath(url, event.id)
  const onClick = () => navigate(path)
</script>

{#if stacked}
  <Cv
    tag={Link}
    href={path}
    class="hover:bg-surface-less flex w-full flex-col gap-2 border-b border-solid border-line px-4 py-3 text-left text-sm transition-colors">
    <p class="truncate font-medium">
      <UnreadDot {path} class="mr-1" />{title || "Untitled thread"}
    </p>
    <div class="text-content-muted flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
      <span class="flex min-w-0 items-center gap-1.5">
        <ProfileCircle pubkey={event.pubkey} {url} size={4} />
        <span class="truncate">
          <ProfileName pubkey={event.pubkey} {url} />
        </span>
      </span>
      <span>{replyCount} {replyCount === 1 ? "reply" : "replies"}</span>
      <span>{formatTimestamp(lastActive)}</span>
    </div>
  </Cv>
{:else}
  <tr
    onclick={onClick}
    class="hover:bg-surface-less cursor-pointer border-b border-solid border-line text-sm transition-colors">
    <td class="max-w-0 truncate px-4 py-3 align-top">
      <UnreadDot {path} class="mr-1" />{title || "Untitled thread"}
    </td>
    <td class="w-32 px-4 py-3 align-middle">
      <div class="flex min-w-0 items-center gap-2">
        <ProfileCircle pubkey={event.pubkey} {url} size={5} />
        <span class="min-w-0 truncate">
          <ProfileName pubkey={event.pubkey} {url} />
        </span>
      </div>
    </td>
    <td class="w-20 px-4 py-3 text-center align-middle">
      {replyCount}
    </td>
    <td class="w-32 whitespace-nowrap px-4 py-3 text-right align-middle">
      {formatTimestamp(lastActive)}
    </td>
  </tr>
{/if}
