<script lang="ts">
  import {uniq} from "@welshman/lib"
  import type {TrustedEvent, EventContent} from "@welshman/util"
  import {Classified} from "@welshman/domain"
  import {goto} from "$app/navigation"
  import Pen2 from "@assets/icons/pen-2.svg?dataurl"
  import {normalizeTopic} from "@lib/util"
  import Link from "@lib/components/Link.svelte"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import RoomName from "@app/components/RoomName.svelte"
  import {publishReaction, retractReaction} from "@app/reactions"
  import ReactionSummary from "@app/components/ReactionSummary.svelte"
  import type {FeedContext} from "@app/feeds"
  import ClassifiedStatus from "@app/components/ClassifiedStatus.svelte"
  import ThunkStatusOrDeleted from "@app/components/ThunkStatusOrDeleted.svelte"
  import EventActivity from "@app/components/EventActivity.svelte"
  import EventActions from "@app/components/EventActions.svelte"
  import ClassifiedEdit from "@app/components/ClassifiedEdit.svelte"
  import {reader, user} from "@app/core"
  import {makeClassifiedPath, makeSpacePath} from "@app/routes"
  import {pushModal} from "@app/modal"

  type Props = {
    url: string
    event: TrustedEvent
    showRoom?: boolean
    showActivity?: boolean
    context: FeedContext
    // The grid card lays these out itself, so it opts out of both.
    showTopics?: boolean
    showStatus?: boolean
  }

  const {
    url,
    event,
    showRoom,
    showActivity,
    context,
    showTopics = true,
    showStatus = true,
  }: Props = $props()

  // Editing hands this a new version of the event, so every value is recomputed rather than captured.
  const classified = $derived(reader(Classified)(event))
  const h = $derived(classified.room())
  const topics = $derived(classified.topics() ?? [])

  const editClassified = () => pushModal(ClassifiedEdit, {url, event})

  const filterByTopic = (topic: string) => (e: MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    goto(`${makeClassifiedPath(url)}?topic=${encodeURIComponent(normalizeTopic(topic))}`)
  }

  const deleteReaction = (reaction: TrustedEvent) => retractReaction(reaction, {url, h})

  const createReaction = (values: EventContent) => publishReaction(event, values, {url, h})
</script>

<div class="flex grow flex-wrap items-center justify-end gap-2">
  {#if (h && showRoom) || (showTopics && uniq(topics).length > 0)}
    <div class="flex min-w-0 flex-wrap items-center gap-2">
      {#if h && showRoom}
        <Link href={makeSpacePath(url, h)} class="button button-neutral button-xs rounded-full">
          Posted in #<RoomName {h} {url} />
        </Link>
      {/if}
      {#if showTopics}
        {#each uniq(topics) as topic (topic)}
          <button
            type="button"
            class="badge badge-neutral badge-sm cursor-pointer font-normal"
            onclick={filterByTopic(topic)}>
            #{normalizeTopic(topic)}
          </button>
        {/each}
      {/if}
    </div>
    <span class="h-6 w-px shrink-0 bg-line"></span>
  {/if}
  <ThunkStatusOrDeleted {event} {context}>
    {#snippet status()}
      {#if showStatus}
        <ClassifiedStatus {event} />
      {/if}
    {/snippet}
    <ReactionSummary
      {url}
      {event}
      {context}
      {deleteReaction}
      {createReaction}
      reactionClass="tip-left" />
    {#if showActivity}
      <EventActivity {event} {context} />
    {/if}
    <EventActions {url} {event} noun="Listing">
      {#snippet customActions()}
        {#if event.pubkey === $user.pubkey}
          <li>
            <Button onclick={editClassified}>
              <Icon size={4} icon={Pen2} />
              Edit Listing
            </Button>
          </li>
        {/if}
      {/snippet}
    </EventActions>
  </ThunkStatusOrDeleted>
</div>
