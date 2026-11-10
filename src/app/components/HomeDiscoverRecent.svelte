<script lang="ts">
  import {onDestroy} from "svelte"
  import Button from "@lib/components/Button.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import NoteEntry from "@app/components/NoteEntry.svelte"
  import {user} from "@app/core/user"
  import {followLists} from "@app/core/plugins"
  import {makeFeedContext} from "@app/features/feeds"
  import {describeDiscoverEntry, makeDiscoverFeed} from "@app/features/social/discoverFeed"

  type Props = {
    onbrowse: () => void
    class?: string
  }

  const {onbrowse, class: className = ""}: Props = $props()

  const context = makeFeedContext({withReplies: true})

  const feed = makeDiscoverFeed()

  const {entries, loading, exhausted} = feed

  const followList = $derived($followLists.one($user.pubkey))
  const follows = $derived($followList?.pubkeys())
  const noFollows = $derived(follows?.length === 0)

  let element: HTMLElement | undefined = $state()
  let started = false

  // The follow list is what the feed is made of, and follows added later don't rebuild it.
  $effect(() => {
    if (!started && element && follows && follows.length > 0) {
      started = true
      feed.start(element, follows)
    }
  })

  onDestroy(() => {
    feed.stop()
    context.cleanup()
  })
</script>

<div class={className}>
  <div class="flex flex-col gap-3 border-t border-line bg-surface-less p-4" bind:this={element}>
    {#if noFollows}
      <div class="flex flex-col items-center gap-3 pb-4 text-center">
        <p class="font-medium">Follow people to see what they like</p>
        <p class="max-w-md text-sm opacity-75">
          Notes the people you follow like or repost collect here. The network tab shows what they
          write.
        </p>
        <Button class="button button-neutral button-sm" onclick={onbrowse}>
          Find people to follow
        </Button>
      </div>
    {:else if $entries.length > 0}
      {#each $entries as entry (entry.key)}
        <div class="flex flex-col gap-1">
          <p class="px-1 text-sm text-content-muted">{describeDiscoverEntry(entry)}</p>
          <NoteEntry
            entry={{key: entry.key, ref: entry.ref, note: entry.note, replies: []}}
            {context} />
        </div>
      {/each}
      {#if $loading}
        <div class="flex justify-center py-8">
          <Spinner loading />
        </div>
      {/if}
    {:else if $loading}
      <div class="flex justify-center py-8">
        <Spinner loading>Looking for what your follows like...</Spinner>
      </div>
    {:else if $exhausted}
      <div class="flex flex-col items-center gap-3 pb-4 text-center">
        <p class="font-medium">Nothing liked or reposted yet</p>
        <p class="max-w-md text-sm opacity-75">
          Notes the people you follow like or repost collect here.
        </p>
      </div>
    {:else}
      <div class="flex justify-center py-8">
        <Spinner loading />
      </div>
    {/if}
  </div>
</div>
