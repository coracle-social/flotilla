<script lang="ts">
  import {onDestroy, onMount} from "svelte"
  import {sleep} from "@welshman/lib"
  import {POLL, POLL_RESPONSE} from "@welshman/util"
  import PageContent from "@lib/components/PageContent.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import SpaceBar from "@app/components/SpaceBar.svelte"
  import NoteCard from "@app/components/NoteCard.svelte"
  import NoteContent from "@app/components/NoteContent.svelte"
  import CommentActions from "@app/components/CommentActions.svelte"
  import EventComments from "@app/components/EventComments.svelte"
  import {events, network} from "@app/core"
  import {makeFeedContext} from "@app/feeds"
  import {decodeRelay} from "@app/relays"
  import type {PageProps} from "./$types"

  const {params}: PageProps = $props()

  const {relay, id} = params
  const url = decodeRelay(relay)
  const context = makeFeedContext({relays: [url]})
  const event = $events.one(id, [url]).$

  const back = () => history.back()

  onDestroy(context.cleanup)

  onMount(() => {
    const controller = new AbortController()

    $network.request({
      relays: [url],
      filters: [
        {kinds: [POLL], ids: [id]},
        {kinds: [POLL_RESPONSE], "#e": [id]},
      ],
      signal: controller.signal,
    })

    return () => {
      controller.abort()
    }
  })
</script>

<SpaceBar {back}>
  {#snippet title()}
    <h1 class="text-xl">{$event?.content || "Poll"}</h1>
  {/snippet}
</SpaceBar>

<PageContent class="flex flex-col gap-2 p-2 sm:gap-4 sm:p-4">
  {#if $event}
    <NoteCard event={$event} {url} class="card z-feature w-full">
      <div class="ml-12 flex flex-col gap-3">
        <NoteContent showEntire event={$event} {url} />
        <CommentActions showActivity {url} event={$event} {context} />
      </div>
    </NoteCard>
    <EventComments event={$event} {url} {context} />
  {:else}
    <div class="flex justify-center py-20">
      {#await sleep(5000)}
        <Spinner loading>Loading poll...</Spinner>
      {:then}
        <p>Failed to load poll.</p>
      {/await}
    </div>
  {/if}
</PageContent>
