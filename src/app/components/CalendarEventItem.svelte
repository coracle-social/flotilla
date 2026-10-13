<script lang="ts">
  import type {TrustedEvent} from "@welshman/util"
  import {getAddress} from "@welshman/util"
  import {TimeEvent} from "@welshman/domain"
  import Link from "@lib/components/Link.svelte"
  import Cv from "@lib/components/Cv.svelte"
  import ContentActions from "@app/components/ContentActions.svelte"
  import CalendarEventEdit from "@app/components/CalendarEventEdit.svelte"
  import {reader} from "@app/core/domain"
  import type {FeedContext} from "@app/features/feeds"
  import CalendarEventHeader from "@app/components/CalendarEventHeader.svelte"
  import ProfileLink from "@app/components/ProfileLink.svelte"
  import RoomLink from "@app/components/RoomLink.svelte"
  import UnreadDot from "@app/components/UnreadDot.svelte"
  import {makeCalendarPath} from "@app/ui/routes"

  type Props = {
    url: string
    event: TrustedEvent
    context: FeedContext
  }

  const {url, event, context}: Props = $props()

  const path = $derived(makeCalendarPath(url, getAddress(event)))
  const h = $derived(reader(TimeEvent)(event).room())
</script>

<Cv tag={Link} class="relative flex flex-col gap-3 card card-interactive w-full" href={path}>
  <UnreadDot {path} class="absolute right-3 top-3" />
  <CalendarEventHeader {event} />
  <div class="flex w-full flex-col items-end justify-between gap-2 sm:flex-row">
    <span class="whitespace-nowrap py-1 text-sm opacity-75">
      Posted by <ProfileLink pubkey={event.pubkey} {url} />
      {#if h}
        in <RoomLink {url} {h} />
      {/if}
    </span>
    <ContentActions
      showActivity
      noun="Event"
      editForm={CalendarEventEdit}
      {url}
      {event}
      {context} />
  </div>
</Cv>
