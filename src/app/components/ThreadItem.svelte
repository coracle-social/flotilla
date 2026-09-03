<script lang="ts">
  import {formatTimestamp} from "@welshman/lib"
  import type {TrustedEvent} from "@welshman/util"
  import {tagSpec, tagValue} from "@welshman/util"
  import Link from "@lib/components/Link.svelte"
  import Content from "@app/components/Content.svelte"
  import ProfileLink from "@app/components/ProfileLink.svelte"
  import ThreadActions from "@app/components/ThreadActions.svelte"
  import type {FeedContext} from "@app/feeds"
  import RoomLink from "@app/components/RoomLink.svelte"
  import UnreadDot from "@app/components/UnreadDot.svelte"
  import {makeThreadPath} from "@app/routes"

  type Props = {
    url: string
    event: TrustedEvent
    context: FeedContext
  }

  const {url, event, context}: Props = $props()

  const path = makeThreadPath(url, event.id)
  const title = tagValue(tagSpec("title"), event.tags)
  const h = tagValue(tagSpec("h"), event.tags)
</script>

<Link class="cv relative flex flex-col gap-2 card card-interactive w-full" href={path}>
  <UnreadDot {path} class="absolute right-3 top-3" />
  {#if title}
    <div class="flex w-full items-center justify-between gap-2">
      <p class="text-xl">{title}</p>
      <p class="text-sm opacity-75">
        {formatTimestamp(event.created_at)}
      </p>
    </div>
  {:else}
    <p class="mb-3 h-0 text-xs opacity-75">
      {formatTimestamp(event.created_at)}
    </p>
  {/if}
  <Content {event} {url} expandMode="inline" />
  <div class="flex w-full flex-col items-end justify-between gap-2 sm:flex-row">
    <span class="whitespace-nowrap py-1 text-sm opacity-75">
      Posted by
      <ProfileLink pubkey={event.pubkey} {url} />
      {#if h}
        in <RoomLink {url} {h} />
      {/if}
    </span>
    <ThreadActions showActivity {url} {event} {context} />
  </div>
</Link>
