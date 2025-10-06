<script lang="ts">
  import type {TrustedEvent, EventContent} from "@welshman/util"
  import {getTagValue} from "@welshman/util"
  import Link from "@lib/components/Link.svelte"
  import ReactionSummary from "@app/components/ReactionSummary.svelte"
  import ThunkStatusOrDeleted from "@app/components/ThunkStatusOrDeleted.svelte"
  import EventActivity from "@app/components/EventActivity.svelte"
  import EventActions from "@app/components/EventActions.svelte"
  import ChannelName from "@app/components/ChannelName.svelte"
  import {publishDelete, publishReaction, canEnforceNip70} from "@app/core/commands"
  import {makeGoalPath, makeSpacePath} from "@app/util/routes"

  interface Props {
    url: string
    event: TrustedEvent
    showRoom?: boolean
    showActivity?: boolean
  }

  const {url, event, showRoom, showActivity}: Props = $props()

  const path = makeGoalPath(url, event.id)
  const room = getTagValue("h", event.tags)
  const shouldProtect = canEnforceNip70(url)

  const deleteReaction = async (event: TrustedEvent) =>
    publishDelete({relays: [url], event, protect: await shouldProtect})

  const createReaction = async (template: EventContent) =>
    publishReaction({...template, event, relays: [url], protect: await shouldProtect})
</script>

<div class="flex flex-grow flex-wrap justify-end gap-2">
  {#if room && showRoom}
    <Link href={makeSpacePath(url, room)} class="btn btn-neutral btn-xs rounded-full">
      Posted in #<ChannelName {room} {url} />
    </Link>
  {/if}
  <ReactionSummary {url} {event} {deleteReaction} {createReaction} reactionClass="tooltip-left" />
  <ThunkStatusOrDeleted {event} />
  {#if showActivity}
    <EventActivity {url} {path} {event} />
  {/if}
  <EventActions {url} {event} hideZap noun="Goal" />
</div>
