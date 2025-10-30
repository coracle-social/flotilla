<script lang="ts">
  import type {TrustedEvent, EventContent} from "@welshman/util"
  import {getTagValue} from "@welshman/util"
  import {pubkey} from "@welshman/app"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import Link from "@lib/components/Link.svelte"
  import RoomName from "@app/components/RoomName.svelte"
  import ReactionSummary from "@app/components/ReactionSummary.svelte"
  import ThunkStatusOrDeleted from "@app/components/ThunkStatusOrDeleted.svelte"
  import EventActivity from "@app/components/EventActivity.svelte"
  import EventActions from "@app/components/EventActions.svelte"
  import CalendarEventEdit from "@app/components/CalendarEventEdit.svelte"
  import {publishDelete, publishReaction, canEnforceNip70} from "@app/core/commands"
  import {makeCalendarPath, makeSpacePath} from "@app/util/routes"
  import {pushModal} from "@app/util/modal"
  import Pen2 from "@assets/icons/pen-2.svg?dataurl"

  type Props = {
    url: string
    event: TrustedEvent
    showRoom?: boolean
    showActivity?: boolean
  }

  const {url, event, showRoom, showActivity}: Props = $props()

  const h = getTagValue("h", event.tags)
  const path = makeCalendarPath(url, event.id)
  const shouldProtect = canEnforceNip70(url)

  const editEvent = () => pushModal(CalendarEventEdit, {url, event})

  const deleteReaction = async (event: TrustedEvent) =>
    publishDelete({relays: [url], event, protect: await shouldProtect})

  const createReaction = async (template: EventContent) =>
    publishReaction({...template, event, relays: [url], protect: await shouldProtect})
</script>

<div class="flex flex-grow flex-wrap justify-end gap-2">
  {#if h && showRoom}
    <Link href={makeSpacePath(url, h)} class="btn btn-neutral btn-xs rounded-full">
      Posted in #<RoomName {h} {url} />
    </Link>
  {/if}
  <ReactionSummary {url} {event} {deleteReaction} {createReaction} reactionClass="tooltip-left" />
  <ThunkStatusOrDeleted {event} />
  {#if showActivity}
    <EventActivity {url} {path} {event} />
  {/if}
  <EventActions {url} {event} noun="Event">
    {#snippet customActions()}
      {#if event.pubkey === $pubkey}
        <li>
          <Button onclick={editEvent}>
            <Icon size={4} icon={Pen2} />
            Edit Event
          </Button>
        </li>
      {/if}
    {/snippet}
  </EventActions>
</div>
