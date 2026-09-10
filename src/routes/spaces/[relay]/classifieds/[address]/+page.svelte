<script lang="ts">
  import {onDestroy} from "svelte"
  import {derived} from "svelte/store"
  import {page} from "$app/stores"
  import {sleep} from "@welshman/lib"
  import type {MakeNonOptional} from "@welshman/lib"
  import {Classified} from "@welshman/domain"
  import PageContent from "@lib/components/PageContent.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import SpaceBar from "@app/components/SpaceBar.svelte"
  import NoteContent from "@app/components/NoteContent.svelte"
  import NoteCard from "@app/components/NoteCard.svelte"
  import ClassifiedActions from "@app/components/ClassifiedActions.svelte"
  import EventComments from "@app/components/EventComments.svelte"
  import {reader} from "@app/core"
  import {deriveEvent} from "@app/repository"
  import {makeFeedContext} from "@app/feeds"
  import {decodeRelay} from "@app/relays"

  const {relay, address} = $page.params as MakeNonOptional<typeof $page.params>
  const url = decodeRelay(relay)
  const context = makeFeedContext({relays: [url]})
  const event = deriveEvent(address, [url])
  const classified = derived(event, $event => ($event ? reader(Classified)($event) : undefined))

  const back = () => history.back()

  onDestroy(context.cleanup)
</script>

<SpaceBar {back}>
  {#snippet title()}
    <h1 class="text-xl">{$classified?.title() ?? ""}</h1>
  {/snippet}
</SpaceBar>

<PageContent class="flex flex-col gap-2 p-2 sm:gap-4 sm:p-4">
  {#if $event}
    <NoteCard event={$event} {url} class="card z-feature w-full">
      <div class="flex flex-col gap-3 ml-12">
        <NoteContent showEntire event={$event} {url} />
        <ClassifiedActions showRoom event={$event} {url} {context} />
      </div>
    </NoteCard>
    <EventComments event={$event} {url} {context} />
  {:else}
    <div class="flex justify-center py-20">
      {#await sleep(5000)}
        <Spinner loading>Loading listing...</Spinner>
      {:then}
        <p>Failed to load classified listing.</p>
      {/await}
    </div>
  {/if}
</PageContent>
