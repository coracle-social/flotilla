<script lang="ts">
  import {onMount} from "svelte"
  import {readable} from "svelte/store"
  import {fly} from "@lib/transition"
  import FeedStatus from "@app/components/FeedStatus.svelte"
  import NoteEntry from "@app/components/NoteEntry.svelte"
  import {makeEngagementIndex} from "@app/features/engagement"
  import {derivePinnedEvents} from "@app/features/pins"
  import {derivePubkeyMuted, makeNoteFeed, makeNotesSource} from "@app/features/social"

  type Props = {
    pubkey: string
  }

  const {pubkey}: Props = $props()

  const engagement = makeEngagementIndex({withReplies: true})

  const muted = derivePubkeyMuted(pubkey)

  const notes = makeNotesSource({onEvent: engagement.add, pubkeys: readable([pubkey])})

  const feed = makeNoteFeed({sources: [notes], pinned: derivePinnedEvents(pubkey)})

  const {entries, loading, status} = feed

  let element: HTMLElement | undefined = $state()

  onMount(() => {
    feed.start(element!)

    return () => {
      feed.stop()
      engagement.stop()
    }
  })
</script>

<div class="flex flex-col gap-4" bind:this={element}>
  {#if $muted}
    <p class="py-12 text-center text-sm opacity-75">You have muted this person.</p>
  {:else}
    {#each $entries as entry (entry.key)}
      <div in:fly>
        <NoteEntry {entry} {engagement} />
      </div>
    {/each}
    <FeedStatus
      status={$status}
      loading={$loading}
      emptyMessage="No notes found for this profile."
      loadingMessage="Loading notes..." />
  {/if}
</div>
