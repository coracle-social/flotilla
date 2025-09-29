<script lang="ts">
  import type {TrustedEvent, EventContent} from "@welshman/util"
  import {pubkey} from "@welshman/app"
  import ReactionSummary from "@app/components/ReactionSummary.svelte"
  import ThunkStatusOrDeleted from "@app/components/ThunkStatusOrDeleted.svelte"
  import EventActivity from "@app/components/EventActivity.svelte"
  import EventActions from "@app/components/EventActions.svelte"
  import {publishDelete, publishReaction, canEnforceNip70} from "@app/core/commands"
  import {makeThreadPath} from "@app/util/routes"
  import Button from "@lib/components/Button.svelte"
  import Icon from "@lib/components/Icon.svelte"
  import Pen2 from "@assets/icons/pen-2.svg?dataurl"
  import {pushModal} from "@app/util/modal"
  import ThreadEdit from "@app/components/ThreadEdit.svelte"

  interface Props {
    url: any
    event: any
    showActivity?: boolean
  }

  const {url, event, showActivity = false}: Props = $props()

  const shouldProtect = canEnforceNip70(url)

  const path = makeThreadPath(url, event.id)

  const editEvent = () => pushModal(ThreadEdit, {url, event})

  const deleteReaction = async (event: TrustedEvent) =>
    publishDelete({relays: [url], event, protect: await shouldProtect})

  const createReaction = async (template: EventContent) =>
    publishReaction({...template, event, relays: [url], protect: await shouldProtect})
</script>

<div class="flex flex-wrap items-center justify-between gap-2">
  <div class="flex flex-grow flex-wrap justify-end gap-2">
    <ReactionSummary {url} {event} {deleteReaction} {createReaction} reactionClass="tooltip-left" />
    <ThunkStatusOrDeleted {event} />
    {#if showActivity}
      <EventActivity {url} {path} {event} />
    {/if}
    <EventActions {url} {event} noun="Thread">
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
</div>
