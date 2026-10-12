<script lang="ts">
  import type {Component, Snippet} from "svelte"
  import type {TrustedEvent, EventContent} from "@welshman/util"
  import {tagSpec, tagValue} from "@welshman/util"
  import Pen2 from "@assets/icons/pen-2.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import Link from "@lib/components/Link.svelte"
  import RoomName from "@app/components/RoomName.svelte"
  import ReactionSummary from "@app/components/ReactionSummary.svelte"
  import PublicationStatusOrDeleted from "@app/components/PublicationStatusOrDeleted.svelte"
  import EventActivity from "@app/components/EventActivity.svelte"
  import EventActions from "@app/components/EventActions.svelte"
  import {user} from "@app/core"
  import type {FeedContext} from "@app/feeds"
  import {publishReaction, retractReaction} from "@app/reactions"
  import {makeSpacePath} from "@app/routes"
  import {pushModal} from "@app/modal"

  type EditForm = Component<{url: string; event: TrustedEvent}>

  type Props = {
    url: string
    event: TrustedEvent
    context: FeedContext
    noun: string
    showRoom?: boolean
    showActivity?: boolean
    hideZap?: boolean
    editForm?: EditForm
    labels?: Snippet
    status?: Snippet
  }

  const {
    url,
    event,
    context,
    noun,
    showRoom,
    showActivity,
    hideZap,
    editForm,
    labels,
    status,
  }: Props = $props()

  const h = $derived(tagValue(tagSpec("h"), event.tags))

  const edit = (form: EditForm) => () => pushModal(form, {url, event})

  const deleteReaction = (reaction: TrustedEvent) => retractReaction(reaction, {url})

  const createReaction = (values: EventContent) => publishReaction(event, values, {url})
</script>

<div class="flex grow flex-wrap items-center justify-end gap-2">
  {#if (h && showRoom) || labels}
    <div class="flex min-w-0 flex-wrap items-center gap-2">
      {#if h && showRoom}
        <Link href={makeSpacePath(url, h)} class="button button-neutral button-xs rounded-full">
          Posted in #<RoomName {h} {url} />
        </Link>
      {/if}
      {@render labels?.()}
    </div>
    <span class="h-6 w-px shrink-0 bg-line"></span>
  {/if}
  <PublicationStatusOrDeleted {event} {context} {status}>
    <ReactionSummary
      {url}
      {event}
      {context}
      {deleteReaction}
      {createReaction}
      hideZaps={hideZap}
      placement="left" />
    {#if showActivity}
      <EventActivity {event} {context} />
    {/if}
    <EventActions {url} {event} {hideZap} {noun}>
      {#snippet customActions()}
        {#if editForm && event.pubkey === $user.pubkey}
          <li>
            <Button onclick={edit(editForm)}>
              <Icon size={4} icon={Pen2} />
              Edit {noun}
            </Button>
          </li>
        {/if}
      {/snippet}
    </EventActions>
  </PublicationStatusOrDeleted>
</div>
