<script lang="ts">
  import type {TrustedEvent, EventContent} from "@welshman/util"
  import {tagSpec, tagValue} from "@welshman/util"
  import Pen2 from "@assets/icons/pen-2.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import Link from "@lib/components/Link.svelte"
  import RoomName from "@app/components/RoomName.svelte"
  import {publishReaction, retractReaction} from "@app/reactions"
  import ReactionSummary from "@app/components/ReactionSummary.svelte"
  import type {FeedContext} from "@app/feeds"
  import ThunkStatusOrDeleted from "@app/components/ThunkStatusOrDeleted.svelte"
  import EventActivity from "@app/components/EventActivity.svelte"
  import EventActions from "@app/components/EventActions.svelte"
  import CalendarEventEdit from "@app/components/CalendarEventEdit.svelte"
  import {user} from "@app/core"
  import {makeSpacePath} from "@app/routes"
  import {pushModal} from "@app/modal"

  type Props = {
    url: string
    event: TrustedEvent
    showRoom?: boolean
    showActivity?: boolean
    context: FeedContext
  }

  const {url, event, showRoom, showActivity, context}: Props = $props()

  const h = $derived(tagValue(tagSpec("h"), event.tags))

  const editEvent = () => pushModal(CalendarEventEdit, {url, event})

  const deleteReaction = (reaction: TrustedEvent) => retractReaction(reaction, {url, h})

  const createReaction = (values: EventContent) => publishReaction(event, values, {url, h})
</script>

<div class="flex grow flex-wrap justify-end gap-2">
  {#if h && showRoom}
    <Link href={makeSpacePath(url, h)} class="button button-neutral button-xs rounded-full">
      Posted in #<RoomName {h} {url} />
    </Link>
  {/if}
  <ThunkStatusOrDeleted {event} {context}>
    <ReactionSummary
      {url}
      {event}
      {context}
      {deleteReaction}
      {createReaction}
      reactionClass="tip tip-left" />
    {#if showActivity}
      <EventActivity {event} {context} />
    {/if}
    <EventActions {url} {event} noun="Event">
      {#snippet customActions()}
        {#if event.pubkey === $user.pubkey}
          <li>
            <Button onclick={editEvent}>
              <Icon size={4} icon={Pen2} />
              Edit Event
            </Button>
          </li>
        {/if}
      {/snippet}
    </EventActions>
  </ThunkStatusOrDeleted>
</div>
