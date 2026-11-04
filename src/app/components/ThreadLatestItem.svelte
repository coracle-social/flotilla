<script lang="ts">
  import {derived} from "svelte/store"
  import {filter, formatTimestamp, max, spec} from "@welshman/lib"
  import type {TrustedEvent} from "@welshman/util"
  import {COMMENT} from "@welshman/util"
  import {Thread} from "@welshman/domain"
  import {navigate} from "@app/navigation/navigate"
  import ProfileCircle from "@app/components/ProfileCircle.svelte"
  import RoomNameWithImage from "@app/components/RoomNameWithImage.svelte"
  import UnreadDot from "@app/components/UnreadDot.svelte"
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
  const onClick = () => navigate(path)
</script>

<tr
  onclick={onClick}
  class="hover:bg-surface-less cursor-pointer border-b border-solid border-line text-sm transition-colors last:border-b-0">
  <td class="w-12 px-4 py-3 align-middle">
    <ProfileCircle pubkey={event.pubkey} {url} size={6} />
  </td>
  <td class="max-w-0 px-4 py-3 align-top">
    <p class="truncate font-medium">
      <UnreadDot {path} class="mr-1" />{title || "Untitled thread"}
    </p>
    <div class="text-content-muted mt-0.5">
      {#if showRoom}
        {#if h}
          <RoomNameWithImage {url} {h} size={4} />
        {:else}
          General
        {/if}
      {/if}
    </div>
  </td>
  <td class="w-16 px-4 py-3 text-center align-middle">{replyCount}</td>
  <td class="w-28 whitespace-nowrap px-4 py-3 text-right align-middle">
    {formatTimestamp(lastActive)}
  </td>
</tr>
