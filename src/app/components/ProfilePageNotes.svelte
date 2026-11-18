<script lang="ts">
  import {onMount} from "svelte"
  import {followScroll} from "@lib/pager"
  import {fly} from "@lib/transition"
  import NoteEntry from "@app/components/NoteEntry.svelte"
  import NoteFeedFooter from "@app/components/NoteFeedFooter.svelte"
  import {makeProfileFeed} from "@app/features/feeds"
  import {derivePubkeyMuted} from "@app/tools/people/muting"

  type Props = {
    pubkey: string
  }

  const {pubkey}: Props = $props()

  const muted = derivePubkeyMuted(pubkey)

  const feed = makeProfileFeed(pubkey)

  const {entries, loading, status} = feed

  let element: HTMLElement | undefined = $state()

  onMount(() => {
    const stopScroll = followScroll(element!, feed.older, {threshold: 2000})

    return () => {
      stopScroll()
      feed.stop()
    }
  })
</script>

<div class="flex flex-col gap-4" bind:this={element}>
  {#if $muted}
    <p class="py-12 text-center text-sm opacity-75">You have muted this person.</p>
  {:else}
    {#each $entries as entry (entry.key)}
      <div in:fly>
        <NoteEntry {entry} />
      </div>
    {/each}
    <NoteFeedFooter
      status={$status}
      loading={$loading}
      emptyMessage="No notes found for this profile."
      loadingMessage="Loading notes..." />
  {/if}
</div>
