<script lang="ts">
  import {onMount} from "svelte"
  import {DatePicker} from "@svelte-plugins/datepicker"
  import CalendarMinimalistic from "@assets/icons/calendar-minimalistic.svg?dataurl"
  import {anchorDatepicker} from "@lib/html"
  import Icon from "@lib/components/Icon.svelte"

  type Props = {
    start?: number | undefined
    end?: number | undefined
  }

  let {start = $bindable(), end = $bindable()}: Props = $props()

  // The picker works in millisecond timestamps, and we expose unix seconds.
  let element: HTMLElement
  let isOpen = $state(false)
  let startDate: number | undefined = $state(start ? start * 1000 : undefined)
  let endDate: number | undefined = $state(end ? end * 1000 : undefined)
  let startDateTime = $state("")
  let endDateTime = $state("")

  // With no date the library initializes its time inputs from the epoch.
  onMount(() => {
    if (!startDate) {
      startDateTime = "12:00"
    }
    if (!endDate) {
      endDateTime = "13:00"
    }
  })

  const toggle = () => {
    isOpen = !isOpen
  }

  const fmt = (ts: number) =>
    new Date(ts).toLocaleString([], {dateStyle: "medium", timeStyle: "short"})

  const display = $derived(
    startDate ? (endDate ? `${fmt(startDate)} – ${fmt(endDate)}` : fmt(startDate)) : "",
  )

  $effect(() => {
    if (isOpen && element) {
      return anchorDatepicker(element)
    }
  })

  $effect(() => {
    start = startDate ? Math.round(startDate / 1000) : undefined
  })

  $effect(() => {
    end = endDate ? Math.round(endDate / 1000) : undefined
  })
</script>

<div class="relative focus-within:z-modal" bind:this={element}>
  <DatePicker
    bind:isOpen
    bind:startDate
    bind:endDate
    bind:startDateTime
    bind:endDateTime
    isRange
    showTimePicker
    enableFutureDates
    includeFont={false}>
    <label class="input input-group cursor-pointer">
      <Icon icon={CalendarMinimalistic} />
      <input
        type="text"
        readonly
        class="grow cursor-pointer"
        placeholder="Select dates"
        value={display}
        onclick={toggle} />
    </label>
  </DatePicker>
</div>
