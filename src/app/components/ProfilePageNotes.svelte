<script lang="ts">
  import {onMount} from "svelte"
  import {fly} from "@lib/transition"
  import Spinner from "@lib/components/Spinner.svelte"
  import NoteEntry from "@app/components/NoteEntry.svelte"
  import {makeFeedContext} from "@app/features/feeds"
  import {derivePinnedEvents} from "@app/features/pins"
  import {derivePubkeyMuted} from "@app/features/social/muting"
  import {makeNoteFeed, makeNotesTimeline} from "@app/features/social/noteFeed"

  type Props = {
    pubkey: string
  }

  const {pubkey}: Props = $props()

  const context = makeFeedContext({withReplies: true})

  const muted = derivePubkeyMuted(pubkey)

  const notes = makeNotesTimeline({onEvent: context.add})

  const feed = makeNoteFeed({sources: [notes], pinned: derivePinnedEvents(pubkey)})

  const {entries, loading, exhausted} = feed

  let element: HTMLElement | undefined = $state()

  onMount(() => {
    notes.start([pubkey])
    feed.start(element!)

    return () => {
      feed.stop()
      context.cleanup()
    }
  })
</script>

<div class="flex flex-col gap-4" bind:this={element}>
  {#if $muted}
    <p class="py-12 text-center text-sm opacity-75">You have muted this person.</p>
  {:else}
    {#each $entries as entry (entry.key)}
      <div in:fly>
        <NoteEntry {entry} {context} />
      </div>
    {/each}
    {#if $exhausted && $entries.length === 0}
      <p class="py-12 text-center text-sm opacity-75">No notes found for this profile.</p>
    {:else if $loading || $entries.length === 0}
      <p class="my-12 flex items-center justify-center gap-2">
        <Spinner loading />
        Loading notes...
      </p>
    {/if}
  {/if}
</div>
