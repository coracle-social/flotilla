<script lang="ts">
  import {onMount} from "svelte"
  import {DatePicker} from "@svelte-plugins/datepicker"
  import CloseCircle from "@assets/icons/close-circle.svg?dataurl"
  import CalendarMinimalistic from "@assets/icons/calendar-minimalistic.svg?dataurl"
  import {anchorDatepicker} from "@lib/html"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"

  type Props = {
    value?: number | undefined
  }

  let {value = $bindable()}: Props = $props()

  // The picker works in millisecond timestamps, and we expose unix seconds.
  let element: HTMLElement
  let isOpen = $state(false)
  let startDate: number | undefined = $state(value ? value * 1000 : undefined)
  let startDateTime = $state("")

  // With no date the library initializes its time input from the epoch.
  onMount(() => {
    if (!startDate) {
      startDateTime = "12:00"
    }
  })

  const toggle = () => {
    isOpen = !isOpen
  }

  const clear = () => {
    startDate = undefined
    isOpen = false
  }

  const fmt = (ts: number) =>
    new Date(ts).toLocaleString([], {dateStyle: "medium", timeStyle: "short"})

  const display = $derived(startDate ? fmt(startDate) : "")

  $effect(() => {
    if (isOpen && element) {
      return anchorDatepicker(element)
    }
  })

  $effect(() => {
    value = startDate ? Math.round(startDate / 1000) : undefined
  })
</script>

<div class="relative focus-within:z-modal" bind:this={element}>
  <DatePicker
    bind:isOpen
    bind:startDate
    bind:startDateTime
    showTimePicker
    enableFutureDates
    includeFont={false}>
    <label class="input input-group cursor-pointer">
      <Icon icon={CalendarMinimalistic} />
      <input
        type="text"
        readonly
        class="grow cursor-pointer"
        placeholder="Select date"
        value={display}
        onclick={toggle} />
      {#if startDate}
        <Button onclick={clear} class="h-5">
          <Icon icon={CloseCircle} />
        </Button>
      {/if}
    </label>
  </DatePicker>
</div>
