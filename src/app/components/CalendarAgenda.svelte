<script lang="ts">
  import {formatTimestampAsDate, now} from "@welshman/lib"
  import type {TrustedEvent} from "@welshman/util"
  import {fly} from "@lib/transition"
  import Divider from "@lib/components/Divider.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import CalendarEventItem from "@app/components/CalendarEventItem.svelte"
  import type {FeedContext} from "@app/feeds"
  import {getEventStart} from "@app/calendar"

  type Props = {
    url: string
    events: TrustedEvent[]
    element?: HTMLElement
    loading: boolean
    context: FeedContext
  }

  const {url, events, element, loading, context}: Props = $props()

  let contentEl: HTMLElement | undefined = $state()

  type Item = {
    event: TrustedEvent
    dateDisplay?: string
    isFirstFutureEvent?: boolean
  }

  const items = $derived.by(() => {
    const todayDateDisplay = formatTimestampAsDate(now())

    let haveISeenTheFuture = false
    let prevDateDisplay: string

    return events
      .filter(event => getEventStart(event))
      .map<Item>(event => {
        const start = getEventStart(event)!
        const newDateDisplay = formatTimestampAsDate(start)
        const dateDisplay = prevDateDisplay === newDateDisplay ? undefined : newDateDisplay
        const isFuture = todayDateDisplay === newDateDisplay || start > now()
        const isFirstFutureEvent = !haveISeenTheFuture && isFuture

        prevDateDisplay = newDateDisplay
        haveISeenTheFuture = isFuture

        return {event, dateDisplay, isFirstFutureEvent}
      })
  })

  let previousScrollHeight = 0
  let prevFirstEventId = ""
  let initialScrollDone = false

  // A name or a count resolving late shifts everything below it, so the item stays pinned.
  let pinnedTarget: HTMLElement | undefined = undefined

  // offsetTop is relative to the nearest positioned ancestor, which the scroll container isn't.
  const recenter = (target: HTMLElement) => {
    if (!element) {
      return
    }

    const elementRect = element.getBoundingClientRect()
    const targetRect = target.getBoundingClientRect()

    element.scrollTop +=
      targetRect.top - elementRect.top - element.clientHeight / 2 + targetRect.height / 2
  }

  $effect(() => {
    if (!element || !contentEl) {
      return
    }

    const unpin = () => {
      pinnedTarget = undefined
    }

    // A ResizeObserver catches an image's own load-driven reflow, which a MutationObserver misses.
    const observer = new ResizeObserver(() => {
      if (pinnedTarget) {
        recenter(pinnedTarget)
      }
    })

    observer.observe(contentEl)
    element.addEventListener("wheel", unpin, {passive: true})
    element.addEventListener("touchmove", unpin, {passive: true})

    return () => {
      observer.disconnect()
      element.removeEventListener("wheel", unpin)
      element.removeEventListener("touchmove", unpin)
    }
  })

  $effect(() => {
    if (items.length === 0 || !element) {
      return
    }

    if (initialScrollDone) {
      // If new events are prepended, adjust the scroll position so that the viewport content remains anchored
      if (prevFirstEventId && items[0].event.id !== prevFirstEventId) {
        const delta = element.scrollHeight - previousScrollHeight

        if (delta > 0) {
          element.scrollTop += delta
        }
      }
    } else {
      const {event} =
        items.find(({event}) => getEventStart(event)! >= now()) ?? items[items.length - 1]
      const target = document.querySelector<HTMLElement>(".calendar-event-" + event.id)

      if (target) {
        // On initial load, center the scroll container on today's date (or the next available event)
        recenter(target)
        pinnedTarget = target
        initialScrollDone = true
      }
    }

    previousScrollHeight = element.scrollHeight
    prevFirstEventId = items[0].event.id
  })
</script>

<div bind:this={contentEl} class="flex flex-col gap-2">
  {#each items as { event, dateDisplay, isFirstFutureEvent } (event.id)}
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
      <Spinner {loading} />
    </p>
  {:else if items.length === 0}
    <p class="flex h-10 items-center justify-center py-20" transition:fly>No events found.</p>
  {:else}
    <p class="flex h-10 items-center justify-center py-20" transition:fly>That's all!</p>
  {/if}
</div>
