<script lang="ts">
  import {onDestroy, onMount} from "svelte"
  import type {Readable} from "svelte/store"
  import {readable} from "svelte/store"
  import {page} from "$app/stores"
  import {now, last, formatTimestampAsDate} from "@welshman/lib"
  import type {Maybe} from "@welshman/lib"
  import type {TrustedEvent} from "@welshman/util"
  import {EVENT_TIME, tagValue, tagSpec} from "@welshman/util"
  import {fly} from "@lib/transition"
  import CalendarMinimalistic from "@assets/icons/calendar-minimalistic.svg?dataurl"
  import Add from "@assets/icons/add.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import PageContent from "@lib/components/PageContent.svelte"
  import Divider from "@lib/components/Divider.svelte"
  import SpaceBar from "@app/components/SpaceBar.svelte"
  import CalendarEventItem from "@app/components/CalendarEventItem.svelte"
  import CalendarEventCreate from "@app/components/CalendarEventCreate.svelte"
  import {pushModal} from "@app/modal"
  import {decodeRelay} from "@app/relays"
  import {makeCommentFilter} from "@app/content"
  import {makeCalendarFeed, makeFeedContext, makeScrollLoader} from "@app/feeds"

  const url = decodeRelay($page.params.relay!)
  const context = makeFeedContext({relays: [url]})

  const makeEvent = () => pushModal(CalendarEventCreate, {url})

  const getStart = (event: TrustedEvent) => parseInt(tagValue(tagSpec("start"), event.tags) || "")

  let element: HTMLElement | undefined = $state()
  onDestroy(context.cleanup)

  let older: Maybe<ReturnType<typeof makeScrollLoader>> = $state()
  let newer: Maybe<ReturnType<typeof makeScrollLoader>> = $state()

  // Unlike the other feeds this one asks whether more might exist rather than whether a request
  // is in flight: a digest fills in progressively across many spans, and a spinner that blinked
  // between each of them would read as broken.
  const loading = $derived(!$older || $older.status !== "exhausted")
  let events: Readable<TrustedEvent[]> = $state(readable([]))

  type Item = {
    event: TrustedEvent
    dateDisplay?: string
    isFirstFutureEvent?: boolean
  }

  const items = $derived.by(() => {
    const todayDateDisplay = formatTimestampAsDate(now())

    let haveISeenTheFuture = false
    let prevDateDisplay: string

    return $events
      .filter(event => !isNaN(getStart(event)))
      .map<Item>(event => {
        const newDateDisplay = formatTimestampAsDate(getStart(event))
        const dateDisplay = prevDateDisplay === newDateDisplay ? undefined : newDateDisplay
        const isFuture = todayDateDisplay === newDateDisplay || getStart(event) > now()
        const isFirstFutureEvent = !haveISeenTheFuture && isFuture

        prevDateDisplay = newDateDisplay
        haveISeenTheFuture = isFuture

        return {event, dateDisplay, isFirstFutureEvent}
      })
  })

  let previousScrollHeight = 0
  let prevFirstEventId = ""
  let centeredEventId = ""

  $effect(() => {
    if (items.length === 0) {
      return
    }

    const {event} = items.find(({event}) => getStart(event) >= now()) || last(items)
    const card = document.querySelector(".calendar-event-" + event.id)

    // The feed arrives in batches, so the first one may hold nothing that hasn't happened yet.
    // Centering again each time a nearer event turns up settles on the right one — and it stops
    // once they have all arrived, because loading further out never changes which is next.
    if (event.id !== centeredEventId && card instanceof HTMLElement) {
      element!.scrollTop = card.offsetTop - element!.clientHeight / 2 + card.clientHeight / 2
      centeredEventId = event.id
    } else if (prevFirstEventId && items[0].event.id !== prevFirstEventId) {
      // Older events prepended above the viewport would otherwise carry its contents down with them
      const delta = element!.scrollHeight - previousScrollHeight

      if (delta > 0) {
        element!.scrollTop += delta
      }
    }

    previousScrollHeight = element!.scrollHeight
    prevFirstEventId = items[0].event.id
  })

  onMount(() => {
    const feed = makeCalendarFeed({
      relays: [url],
      onEvent: context.add,
      filters: [{kinds: [EVENT_TIME]}, makeCommentFilter([EVENT_TIME])],
    })

    events = feed.events

    // The calendar runs in both directions from today, so both ends fetch as they are reached
    older = makeScrollLoader(element!, feed.loadOlder, {reverse: true})
    newer = makeScrollLoader(element!, feed.loadNewer)

    return () => {
      older?.stop()
      newer?.stop()
      feed.cleanup()
    }
  })
</script>

<SpaceBar>
  {#snippet leading()}
    <Icon icon={CalendarMinimalistic} />
  {/snippet}
  {#snippet title()}
    <strong>Calendar</strong>
  {/snippet}
  {#snippet action()}
    <Button class="button button-primary button-sm" onclick={makeEvent}>
      <Icon icon={Add} />
      Create
    </Button>
  {/snippet}
</SpaceBar>

<PageContent bind:element class="flex flex-col gap-2 p-2 sm:px-4">
  {#each items as { event, dateDisplay, isFirstFutureEvent }, i (event.id)}
    <div class="flex flex-col gap-2 calendar-event-{event.id}">
      {#if isFirstFutureEvent}
        <div class="flex items-center gap-2 p-2">
          <div class="h-px grow bg-primary text-primary-content"></div>
          <p class="text-xs uppercase text-primary">Today</p>
          <div class="h-px grow bg-primary text-primary-content"></div>
        </div>
      {/if}
      {#if dateDisplay}
        <Divider>{dateDisplay}</Divider>
      {/if}
      <CalendarEventItem {url} {event} {context} />
    </div>
  {/each}
  {#if loading}
    <p class="flex h-10 items-center justify-center py-20" transition:fly>
      <Spinner {loading}>Looking for events...</Spinner>
    </p>
  {:else if items.length === 0}
    <p class="flex h-10 items-center justify-center py-20" transition:fly>No events found.</p>
  {:else}
    <p class="flex h-10 items-center justify-center py-20" transition:fly>That's all!</p>
  {/if}
</PageContent>
