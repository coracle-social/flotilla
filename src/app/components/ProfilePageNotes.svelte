<script lang="ts">
  import {onMount} from "svelte"
  import {NOTE, outbox} from "@welshman/util"
  import {fly} from "@lib/transition"
  import Spinner from "@lib/components/Spinner.svelte"
  import NoteEntry from "@app/components/NoteEntry.svelte"
  import {router} from "@app/core/plugins"
  import {makeFeedContext} from "@app/features/feeds"
  import {derivePinnedEvents} from "@app/features/pins"
  import {makeNetworkFeed} from "@app/features/social"

  type Props = {
    pubkey: string
  }

  const {pubkey}: Props = $props()

  const context = makeFeedContext({
    relays: $router.resolver.relays([outbox(pubkey)]),
    withReplies: true,
  })

  const feed = makeNetworkFeed({
    context,
    kinds: [NOTE],
    pinned: derivePinnedEvents(pubkey),
    sortByTime: true,
  })

  const {entries, loading, exhausted} = feed

  let element: HTMLElement | undefined = $state()

  onMount(() => {
    feed.start(element!, [pubkey])

    return () => {
      feed.stop()
      context.cleanup()
    }
  })
</script>

<div class="flex flex-col gap-4" bind:this={element}>
  {#each $entries as entry (entry.ref.id)}
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
</div>
