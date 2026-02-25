<script lang="ts">
  import {uniq} from "@welshman/lib"
  import type {TrustedEvent, EventContent} from "@welshman/util"
  import {getTagValue, getTagValues, getAddress} from "@welshman/util"
  import {pubkey} from "@welshman/app"
  import Pen2 from "@assets/icons/pen-2.svg?dataurl"
  import {normalizeTopic} from "@lib/util"
  import Link from "@lib/components/Link.svelte"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import RoomName from "@app/components/RoomName.svelte"
  import ReactionSummary from "@app/components/ReactionSummary.svelte"
  import ClassifiedStatus from "@app/components/ClassifiedStatus.svelte"
  import ThunkStatusOrDeleted from "@app/components/ThunkStatusOrDeleted.svelte"
  import EventActivity from "@app/components/EventActivity.svelte"
  import EventActions from "@app/components/EventActions.svelte"
  import ClassifiedEdit from "@app/components/ClassifiedEdit.svelte"
  import {publishDelete, publishReaction, canEnforceNip70} from "@app/core/commands"
  import {makeClassifiedPath, makeSpacePath} from "@app/util/routes"
  import {pushModal} from "@app/util/modal"

  interface Props {
    url: string
    event: TrustedEvent
    showRoom?: boolean
    showActivity?: boolean
  }

  const {url, event, showRoom, showActivity}: Props = $props()

  const h = getTagValue("h", event.tags)
  const topics = getTagValues("t", event.tags)
  const path = makeClassifiedPath(url, getAddress(event))
  const shouldProtect = canEnforceNip70(url)

  const editClassified = () => pushModal(ClassifiedEdit, {url, event})

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
  <div class="flex min-w-0 flex-wrap gap-2">
    {#each uniq(topics) as topic (topic)}
      <button type="button" class="btn btn-xs rounded-full font-normal">
        #{normalizeTopic(topic)}
      </button>
    {/each}
  </div>
  <ReactionSummary {url} {event} {deleteReaction} {createReaction} reactionClass="tooltip-left" />
  <ThunkStatusOrDeleted {event}>
    <ClassifiedStatus {event} />
  </ThunkStatusOrDeleted>
  {#if showActivity}
    <EventActivity {url} {path} {event} />
  {/if}
  <EventActions {url} {event} noun="Listing">
    {#snippet customActions()}
      {#if event.pubkey === $pubkey}
        <li>
          <Button onclick={editClassified}>
            <Icon size={4} icon={Pen2} />
            Edit Listing
          </Button>
        </li>
      {/if}
    {/snippet}
  </EventActions>
</div>
