<script lang="ts">
  import {goto} from "$app/navigation"
  import {derived} from "svelte/store"
  import {filter, formatTimestamp, max, spec} from "@welshman/lib"
  import type {TrustedEvent} from "@welshman/util"
  import {COMMENT, tagSpec, tagValue} from "@welshman/util"
  import {fade} from "@lib/transition"
  import Link from "@lib/components/Link.svelte"
  import ProfileCircle from "@app/components/ProfileCircle.svelte"
  import ProfileName from "@app/components/ProfileName.svelte"
  import type {FeedContext} from "@app/feeds"
  import {notifications} from "@app/notifications"
  import {makeThreadPath} from "@app/routes"

  type Props = {
    url: string
    event: TrustedEvent
    context: FeedContext
    mobile?: boolean
  }

  const {url, event, context, mobile = false}: Props = $props()

  const related = context.related(event)
  const replies = derived(related, $related => filter(spec({kind: COMMENT}), $related))
  const replyCount = $derived($replies.length)
  const lastActive = $derived(max([...$replies, event].map(e => e.created_at)))
  const title = tagValue(tagSpec("title"), event.tags)
  const path = makeThreadPath(url, event.id)
  const onClick = () => goto(path)
</script>

{#snippet unread()}
  {#if $notifications.has(path)}
    <div class="mr-1 inline-block h-2 w-2 rounded-full bg-primary" transition:fade></div>
  {/if}
{/snippet}

{#if mobile}
  <Link
    href={path}
    class="cv hover:bg-surface-less flex w-full flex-col gap-2 border-b border-solid border-line px-4 py-3 text-left text-sm transition-colors">
    <p class="truncate font-medium">{@render unread()}{title || "Untitled thread"}</p>
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
  </Link>
{:else}
  <tr
    onclick={onClick}
    class="hover:bg-surface-less cursor-pointer border-b border-solid border-line text-sm transition-colors">
    <td class="max-w-0 truncate px-4 py-3 align-top">
      {@render unread()}{title || "Untitled thread"}
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
