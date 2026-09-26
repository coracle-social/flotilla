<script module lang="ts">
  type EventTab = "about" | "discussion" | "people"
</script>

<script lang="ts">
  import {onDestroy} from "svelte"
  import {derived, readable} from "svelte/store"
  import {sleep} from "@welshman/lib"
  import type {TrustedEvent} from "@welshman/util"
  import {getCommentFiltersForRoot} from "@welshman/util"
  import {TimeEvent} from "@welshman/domain"
  import PageContent from "@lib/components/PageContent.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import SegmentedButtons from "@lib/components/SegmentedButtons.svelte"
  import type {SegmentedOption} from "@lib/components/SegmentedButtons.svelte"
  import SpaceBar from "@app/components/SpaceBar.svelte"
  import Content from "@app/components/Content.svelte"
  import ContentActions from "@app/components/ContentActions.svelte"
  import CalendarEventEdit from "@app/components/CalendarEventEdit.svelte"
  import CalendarEventHeader from "@app/components/CalendarEventHeader.svelte"
  import CalendarEventMeta from "@app/components/CalendarEventMeta.svelte"
  import CalendarEventDate from "@app/components/CalendarEventDate.svelte"
  import EventComments from "@app/components/EventComments.svelte"
  import CalendarEventPeople from "@app/components/CalendarEventPeople.svelte"
  import CalendarRsvp from "@app/components/CalendarRsvp.svelte"
  import {deriveRsvps, getRsvpsByStatus, makeRsvpFilter} from "@app/calendar"
  import {events, network, reader} from "@app/core"
  import {makeFeedContext} from "@app/feeds"
  import {decodeRelay} from "@app/relays"
  import type {PageProps} from "./$types"

  const {params}: PageProps = $props()

  const {relay, address} = params
  const url = decodeRelay(relay)
  const context = makeFeedContext({relays: [url]})
  const event = $events.one(address, [url]).$
  const timeEvent = derived(event, $event => ($event ? reader(TimeEvent)($event) : undefined))
  const filters = $derived($event ? getCommentFiltersForRoot([$event]) : [])
  const comments = $derived($events.asc(filters).$)
  const rsvps = $derived($event ? deriveRsvps($event) : readable<TrustedEvent[]>([]))
  const people = $derived(getRsvpsByStatus($rsvps))
  const tabs: SegmentedOption<EventTab>[] = $derived([
    {value: "about", label: "About"},
    {value: "discussion", label: "Discussion", count: $comments.length || undefined},
    {value: "people", label: "People", count: people.latest.length || undefined},
  ])

  const back = () => history.back()

  const showPeople = () => {
    tab = "people"
  }

  onDestroy(context.cleanup)

  let tab = $state<EventTab>("about")

  $effect(() => {
    if (filters.length > 0) {
      const controller = new AbortController()

      $network.request({relays: [url], filters, signal: controller.signal})

      return () => controller.abort()
    }
  })

  $effect(() => {
    if ($event) {
      const controller = new AbortController()

      $network.request({
        relays: [url],
        filters: [makeRsvpFilter($event)],
        signal: controller.signal,
      })

      return () => controller.abort()
    }
  })
</script>

<SpaceBar {back}>
  {#snippet title()}
    <h1 class="text-xl">{$timeEvent?.title() ?? ""}</h1>
  {/snippet}
</SpaceBar>

<PageContent class="flex flex-col gap-2 p-2 sm:gap-4 sm:p-4">
  {#if $event}
    <div class="card z-feature flex items-start gap-4">
      <CalendarEventDate event={$event} />
      <div class="flex min-w-0 grow flex-col gap-2">
        <CalendarEventHeader event={$event} />
        <CalendarEventMeta event={$event} {url} />
        <CalendarRsvp {url} event={$event} rsvps={$rsvps} onShowPeople={showPeople} />
        <ContentActions
          showRoom
          noun="Event"
          editForm={CalendarEventEdit}
          {url}
          event={$event}
          {context} />
      </div>
    </div>
    <!-- One event carries three unrelated conversations, so give each its own tab instead of
         stacking them all down the page -->
    <SegmentedButtons
      joined
      options={tabs}
      bind:value={tab}
      class="w-full sm:w-auto sm:self-start" />
    {#if tab === "about"}
      <div class="card z-feature flex flex-col gap-3">
        {#if $event.content.trim()}
          <Content showEntire event={$event} {url} />
        {:else}
          <p class="flex items-center justify-center py-6 opacity-75">
            The host hasn't added a description.
          </p>
        {/if}
      </div>
    {:else if tab === "discussion"}
      <EventComments {url} event={$event} {context} />
    {:else}
      <CalendarEventPeople {url} event={$event} rsvps={$rsvps} />
    {/if}
  {:else}
    <div class="flex justify-center py-20">
      {#await sleep(5000)}
        <Spinner loading>Loading event...</Spinner>
      {:then}
        <p>Failed to load event.</p>
      {/await}
    </div>
  {/if}
</PageContent>
