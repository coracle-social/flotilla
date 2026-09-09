<script lang="ts">
  import type {TrustedEvent} from "@welshman/util"
  import {tagSpec, tagValue} from "@welshman/util"
  import Link from "@lib/components/Link.svelte"
  import Cv from "@lib/components/Cv.svelte"
  import NoteContent from "@app/components/NoteContent.svelte"
  import PollActions from "@app/components/PollActions.svelte"
  import type {FeedContext} from "@app/feeds"
  import RoomLink from "@app/components/RoomLink.svelte"
  import ProfileLink from "@app/components/ProfileLink.svelte"
  import UnreadDot from "@app/components/UnreadDot.svelte"
  import {makePollPath} from "@app/routes"

  type Props = {
    url: string
    event: TrustedEvent
    context: FeedContext
  }

  const {url, event, context}: Props = $props()

  const path = makePollPath(url, event.id)
  const h = tagValue(tagSpec("h"), event.tags)
</script>

<Cv tag={Link} class="relative flex flex-col gap-2 card card-interactive w-full" href={path}>
  <UnreadDot {path} class="absolute right-3 top-3" />
  <NoteContent {event} {url} />
  <div class="flex w-full flex-col items-end justify-between gap-2 sm:flex-row">
    <span class="whitespace-nowrap py-1 text-sm opacity-75">
      Posted by <ProfileLink pubkey={event.pubkey} {url} />
      {#if h}
        in <RoomLink {url} {h} />
      {/if}
    </span>
    <PollActions showActivity {url} {event} {context} />
  </div>
</Cv>
