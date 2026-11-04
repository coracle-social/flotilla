<script lang="ts">
  import {derived} from "svelte/store"
  import {filter, formatTimestamp, max, spec} from "@welshman/lib"
  import type {TrustedEvent} from "@welshman/util"
  import {COMMENT} from "@welshman/util"
  import {Thread} from "@welshman/domain"
  import Link from "@lib/components/Link.svelte"
  import ProfileCircle from "@app/components/ProfileCircle.svelte"
  import ProfileName from "@app/components/ProfileName.svelte"
  import RoomNameWithImage from "@app/components/RoomNameWithImage.svelte"
  import UnreadDot from "@app/components/UnreadDot.svelte"
  import ContentMinimal from "@app/components/ContentMinimal.svelte"
  import {reader} from "@app/core/domain"
  import type {FeedContext} from "@app/features/feeds"
  import * as pages from "@app/navigation/pages"

  type Props = {
    url: string
    event: TrustedEvent
    context: FeedContext
    // The row's board, left off a page that already says which board it is.
    showRoom?: boolean
  }

  const {url, event, context, showRoom = true}: Props = $props()

  const related = context.related(event)
  const replies = derived(related, $related => filter(spec({kind: COMMENT}), $related))
  const replyCount = $derived($replies.length)
  const lastActive = $derived(max([...$replies, event].map(e => e.created_at)))
  const title = reader(Thread)(event).title()
  const path = pages.thread.path({url, id: event.id})
  const h = reader(Thread)(event).room() || ""
</script>

<Link
  href={path}
  class="group flex flex-col gap-2 border-b border-solid border-line px-4 py-3 transition-colors last:border-b-0 hover:bg-surface-less">
  <div class="flex min-w-0 items-start gap-3">
    <ProfileCircle pubkey={event.pubkey} {url} size={8} class="mt-0.5 shrink-0" />
    <div class="flex min-w-0 grow flex-col gap-1">
      <p class="truncate font-medium">
        <UnreadDot {path} class="mr-1" />{title || "Untitled thread"}
      </p>
      <div class="text-content-muted flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
        <ProfileName pubkey={event.pubkey} {url} />
        {#if showRoom}
          {#if h}
            <RoomNameWithImage {url} {h} size={4} />
          {:else}
            <span>General</span>
          {/if}
        {/if}
      </div>
      {#if event.content}
        <ContentMinimal {event} {url} class="line-clamp-2 text-sm" />
      {/if}
    </div>
    <div class="shrink-0 text-right text-xs text-content-muted">
      <div class="whitespace-nowrap">{replyCount} {replyCount === 1 ? "reply" : "replies"}</div>
      <div class="whitespace-nowrap">{formatTimestamp(lastActive)}</div>
    </div>
  </div>
</Link>
