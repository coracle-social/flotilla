<script lang="ts">
  import {onMount} from "svelte"
  import {DatePicker} from "@svelte-plugins/datepicker"
  import CloseCircle from "@assets/icons/close-circle.svg?dataurl"
  import CalendarMinimalistic from "@assets/icons/calendar-minimalistic.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"

  type Props = {
    value?: number | undefined
    end?: number | undefined
    isRange?: boolean
  }

  let {value = $bindable(), end = $bindable(), isRange = false}: Props = $props()

  const toggle = () => {
    isOpen = !isOpen
  }

  const clear = () => {
    startDate = undefined
    isOpen = false
  }

  const fmt = (ts: number) =>
    new Date(ts).toLocaleString([], {dateStyle: "medium", timeStyle: "short"})

  // Fixed positioning so the popup escapes scroll-container clipping.
  const anchor = () => {
    const reposition = () => {
      const label = element.querySelector("label")
      const container = element.querySelector<HTMLElement>(".calendars-container")

      if (label && container) {
        const margin = 8
        const rect = label.getBoundingClientRect()
        const height = container.offsetHeight
        const width = container.offsetWidth

        let top = rect.bottom + 4

        // flip above the input when there's not enough room below, else pin to the bottom edge
        if (height && top + height > innerHeight - margin) {
          top =
            rect.top - height - 4 >= margin
              ? rect.top - height - 4
              : Math.max(margin, innerHeight - height - margin)
        }

        const left = width
          ? Math.max(margin, Math.min(rect.left, innerWidth - width - margin))
          : rect.left

        element.style.setProperty("--datepicker-container-position", "fixed")
        element.style.setProperty("--datepicker-container-top", `${top}px`)
        element.style.setProperty("--datepicker-container-left", `${left}px`)
      }
    }

    reposition()
    addEventListener("scroll", reposition, true)
    addEventListener("resize", reposition)

    return () => {
      removeEventListener("scroll", reposition, true)
      removeEventListener("resize", reposition)
    }
  }

  // The picker works in millisecond timestamps, and we expose unix seconds.
  let element: HTMLElement
  let isOpen = $state(false)
  let startDate: number | undefined = $state(value ? value * 1000 : undefined)
  let endDate: number | undefined = $state(end ? end * 1000 : undefined)
  let startDateTime = $state("")
  let endDateTime = $state("")

  const display = $derived(
    startDate ? (endDate ? `${fmt(startDate)} – ${fmt(endDate)}` : fmt(startDate)) : "",
  )

  $effect(() => {
    if (isOpen && element) {
      return anchor()
    }
  })

  $effect(() => {
    value = startDate ? Math.round(startDate / 1000) : undefined
  })

  $effect(() => {
    end = endDate ? Math.round(endDate / 1000) : undefined
  })

  // With no date the library initializes its time inputs from the epoch.
  onMount(() => {
    if (!startDate) {
      startDateTime = "12:00"
    }
    if (!endDate) {
      endDateTime = "13:00"
    }
  })
</script>

<div class="relative focus-within:z-modal" bind:this={element}>
  <DatePicker
    bind:isOpen
    bind:startDate
    bind:endDate
    bind:startDateTime
    bind:endDateTime
    {isRange}
    showTimePicker
    enableFutureDates
    includeFont={false}>
    <label class="input input-group cursor-pointer">
      <Icon icon={CalendarMinimalistic} />
      <input
        type="text"
        readonly
        class="grow cursor-pointer"
        placeholder={isRange ? "Select dates" : "Select date"}
        value={display}
        onclick={toggle} />
      {#if startDate && !isRange}
        <Button onclick={clear} class="h-5">
          <Icon icon={CloseCircle} />
        </Button>
      {/if}
    </label>
  </DatePicker>
</div>
