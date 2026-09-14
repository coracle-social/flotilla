<script module lang="ts">
  type EventTab = "about" | "discussion" | "people"
</script>

<script lang="ts">
  import {onDestroy} from "svelte"
  import cx from "classnames"
  import {derived, readable} from "svelte/store"
  import {page} from "$app/stores"
  import {sleep} from "@welshman/lib"
  import type {MakeNonOptional} from "@welshman/lib"
  import type {TrustedEvent} from "@welshman/util"
  import {getCommentFiltersForRoot} from "@welshman/util"
  import {TimeEvent} from "@welshman/domain"
  import PageContent from "@lib/components/PageContent.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import Button from "@lib/components/Button.svelte"
  import SpaceBar from "@app/components/SpaceBar.svelte"
  import Content from "@app/components/Content.svelte"
  import CalendarEventActions from "@app/components/CalendarEventActions.svelte"
  import CalendarEventHeader from "@app/components/CalendarEventHeader.svelte"
  import CalendarEventMeta from "@app/components/CalendarEventMeta.svelte"
  import CalendarEventDate from "@app/components/CalendarEventDate.svelte"
  import CalendarEventDiscussion from "@app/components/CalendarEventDiscussion.svelte"
  import CalendarEventPeople from "@app/components/CalendarEventPeople.svelte"
  import CalendarRsvp from "@app/components/CalendarRsvp.svelte"
  import {deriveRsvps, getRsvpsByStatus, makeRsvpFilter} from "@app/calendar"
  import {network, reader} from "@app/core"
  import {deriveEvent, deriveEvents} from "@app/repository"
  import {makeFeedContext} from "@app/feeds"
  import {decodeRelay} from "@app/relays"

  const {relay, address} = $page.params as MakeNonOptional<typeof $page.params>
  const url = decodeRelay(relay)
  const context = makeFeedContext({relays: [url]})
  const event = deriveEvent(address, [url])
  const timeEvent = derived(event, $event => ($event ? reader(TimeEvent)($event) : undefined))
  const filters = $derived($event ? getCommentFiltersForRoot([$event]) : [])
  const replies = $derived(deriveEvents(filters))
  const rsvps = $derived($event ? deriveRsvps($event) : readable<TrustedEvent[]>([]))
  const people = $derived(getRsvpsByStatus($rsvps))

  const back = () => history.back()

  const showTab = (target: EventTab) => () => {
    tab = target
  }

  const tabClass = (target: EventTab) =>
    cx("button button-sm join-item grow", tab === target ? "button-primary" : "button-neutral")

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
        <CalendarRsvp {url} event={$event} rsvps={$rsvps} onShowPeople={showTab("people")} />
        <CalendarEventActions showRoom {url} event={$event} {context} />
      </div>
    </div>
    <!-- One event carries three unrelated conversations, so give each its own tab instead of
         stacking them all down the page -->
    <div class="join w-full sm:w-auto sm:self-start">
      <Button class={tabClass("about")} aria-pressed={tab === "about"} onclick={showTab("about")}>
        About
      </Button>
      <Button
        class={tabClass("discussion")}
        aria-pressed={tab === "discussion"}
        onclick={showTab("discussion")}>
        Discussion
        {#if $replies.length > 0}
          <span class="opacity-75">{$replies.length}</span>
        {/if}
      </Button>
      <Button
        class={tabClass("people")}
        aria-pressed={tab === "people"}
        onclick={showTab("people")}>
        People
        {#if people.latest.length > 0}
          <span class="opacity-75">{people.latest.length}</span>
        {/if}
      </Button>
    </div>
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
      <CalendarEventDiscussion {url} event={$event} replies={$replies} {context} />
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
