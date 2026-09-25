<script lang="ts">
  import {onDestroy} from "svelte"
  import {derived} from "svelte/store"
  import {sleep, uniq} from "@welshman/lib"
  import {Classified} from "@welshman/domain"
  import {normalizeTopic} from "@lib/util"
  import Link from "@lib/components/Link.svelte"
  import PageContent from "@lib/components/PageContent.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import SpaceBar from "@app/components/SpaceBar.svelte"
  import NoteContent from "@app/components/NoteContent.svelte"
  import NoteCard from "@app/components/NoteCard.svelte"
  import ContentActions from "@app/components/ContentActions.svelte"
  import ClassifiedEdit from "@app/components/ClassifiedEdit.svelte"
  import ClassifiedStatus from "@app/components/ClassifiedStatus.svelte"
  import EventComments from "@app/components/EventComments.svelte"
  import {events, reader} from "@app/core"
  import {makeFeedContext} from "@app/feeds"
  import {decodeRelay} from "@app/relays"
  import {makeClassifiedPath} from "@app/routes"
  import type {PageProps} from "./$types"

  const {params}: PageProps = $props()

  const {relay, address} = params
  const url = decodeRelay(relay)
  const context = makeFeedContext({relays: [url]})
  const event = $events.one(address, [url]).$
  const classified = derived(event, $event => ($event ? reader(Classified)($event) : undefined))

  const topics = $derived(uniq(($classified?.topics() ?? []).map(normalizeTopic)))

  const back = () => history.back()

  onDestroy(context.cleanup)
</script>

{#snippet topicLinks()}
  {#each topics as topic (topic)}
    <Link
      href="{makeClassifiedPath(url)}?topic={encodeURIComponent(topic)}"
      class="badge badge-neutral badge-sm font-normal">
      #{topic}
    </Link>
  {/each}
{/snippet}

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
        <ContentActions
          showRoom
          noun="Listing"
          editForm={ClassifiedEdit}
          labels={topics.length > 0 ? topicLinks : undefined}
          event={$event}
          {url}
          {context}>
          {#snippet status()}
            <ClassifiedStatus event={$event} />
          {/snippet}
        </ContentActions>
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
