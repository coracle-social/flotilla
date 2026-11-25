<script lang="ts">
  import cx from "classnames"
  import {onMount} from "svelte"
  import type {Snippet} from "svelte"
  import type {TrustedEvent} from "@welshman/util"
  import ReplyButton from "@lib/components/ReplyButton.svelte"
  import NoteContent from "@app/components/NoteContent.svelte"
  import EventMenuButton from "@app/components/EventMenuButton.svelte"
  import NoteCard from "@app/components/NoteCard.svelte"
  import NoteSpaceLink from "@app/components/NoteSpaceLink.svelte"
  import NoteThreadLinks from "@app/components/NoteThreadLinks.svelte"
  import EventReactions from "@app/components/EventReactions.svelte"
  import Cv from "@lib/components/Cv.svelte"
  import {app} from "@app/core/app"
  import {events} from "@app/core/plugins"
  import {CONTENT_KINDS} from "@app/tools/content"
  import {getRepliesFilters, loadReplies} from "@app/tools/interactions/interactions"
  import {isReplyTo} from "@app/tools/targets"
  import {openEventNote} from "@app/navigation/overlays"
  import {getActivityTarget, getSpaceEventPath} from "@app/navigation/locations"
  import {navigate} from "@app/navigation/navigate"

  type Props = {
    event: TrustedEvent
    children?: Snippet
    url?: string
    customActions?: Snippet<[TrustedEvent]>
    card?: boolean
    interactive?: boolean
    onOpen?: () => void
    showEntire?: boolean
    showReply?: boolean
    showThreadLinks?: boolean
    spaceUrls?: string[]
  }

  const {
    url,
    event,
    children,
    customActions,
    card = true,
    interactive = card,
    onOpen,
    showEntire = false,
    showReply = false,
    showThreadLinks = false,
    spaceUrls = [],
  }: Props = $props()

  // Space content shown outside the space it came from links there instead of taking actions here.
  const spaceUrl = $derived.by(() => {
    if (CONTENT_KINDS.includes(getActivityTarget(event).kind)) {
      const relays = $app.repository.tracker.getRelays(event.id)

      return spaceUrls.find(candidate => relays.has(candidate))
    }
  })

  const related = $events.desc(getRepliesFilters([event])).$

  // A kind 1 reply e-tags every note above it, so only the ones answering this note count.
  const replyCount = $derived($related.filter(e => isReplyTo(e, event)).length)

  const openReplies = () => openEventNote(event, {reply: true})

  const goToSpace = (spaceUrl: string) => () => navigate(getSpaceEventPath(event, spaceUrl))

  const open = $derived(spaceUrl ? goToSpace(spaceUrl) : onOpen)

  onMount(() => loadReplies(event, url ?? spaceUrl))
</script>

{#snippet actions()}
  {@render customActions?.(event)}
{/snippet}

{#snippet body()}
  {#if showThreadLinks}
    <NoteThreadLinks {event} />
  {/if}
  <NoteContent {event} {showEntire} expandMode="inline" />
  <div class="flex w-full justify-between gap-2">
    {#if spaceUrl}
      <NoteSpaceLink {event} url={spaceUrl} />
    {:else}
      <EventReactions {event} {url} placement="right" />
    {/if}
    <div class="flex shrink-0 items-center gap-2">
      {#if showReply && !spaceUrl}
        <ReplyButton count={replyCount} onclick={openReplies} />
      {/if}
      {@render children?.()}
      <EventMenuButton
        url={url ?? spaceUrl}
        {event}
        noun="Note"
        customActions={actions}
        class="rounded-full" />
    </div>
  </div>
{/snippet}

{#if card}
  <Cv
    tag={NoteCard}
    {event}
    url={url ?? spaceUrl}
    {interactive}
    onOpen={open}
    class="card card-interactive">
    {@render body()}
  </Cv>
{:else}
  <NoteCard
    {event}
    url={url ?? spaceUrl}
    {interactive}
    onOpen={open}
    class={cx({"cursor-pointer": interactive})}>
    {@render body()}
  </NoteCard>
{/if}
