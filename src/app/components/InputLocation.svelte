<script lang="ts">
  import {debounce} from "throttle-debounce"
  import MapPoint from "@assets/icons/map-point.svg?dataurl"
  import Magnifier from "@assets/icons/magnifier.svg?dataurl"
  import CloseCircle from "@assets/icons/close-circle.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import {
    displayPlace,
    granularityLabels,
    placeGeohash,
    placeGranularities,
    searchPlaces,
  } from "@app/location"
  import type {Granularity, Place} from "@app/location"

  type Props = {
    location?: string
    geohash?: string
  }

  let {location = $bindable(), geohash = $bindable()}: Props = $props()

  const fullName = (candidate: Place) => displayPlace(candidate, placeGranularities(candidate)[0])

  const apply = (picked: Place) => {
    location = displayPlace(picked, granularity)
    geohash = placeGeohash(picked, granularity)
  }

  const search = debounce(400, async (value: string) => {
    try {
      const places = await searchPlaces(value)

      if (value === term.trim()) {
        results = places
        failed = false
      }
    } catch (error) {
      console.error(error)
      failed = true
    } finally {
      loading = false
    }
  })

  const onInput = () => {
    const value = term.trim()

    if (value.length > 1) {
      loading = true
      failed = false
      search(value)
    } else {
      results = []
      loading = false
    }
  }

  const pick = (picked: Place) => {
    place = picked
    granularity = placeGranularities(picked)[0]
    term = ""
    results = []
    apply(picked)
  }

  const changeGranularity = () => {
    if (place) {
      apply(place)
    }
  }

  const clear = () => {
    place = undefined
    location = undefined
    geohash = undefined
  }

  let term = $state("")
  let results: Place[] = $state([])
  let loading = $state(false)
  let failed = $state(false)
  let place: Place | undefined = $state()
  let granularity: Granularity = $state("city")
  let list: HTMLElement | undefined = $state()

  // The field sits deep enough in the form that results can open below the fold.
  $effect(() => {
    if (results.length > 0) {
      list?.scrollIntoView({block: "nearest"})
    }
  })
</script>

{#if location}
  <div class="flex flex-col gap-2">
    <div class="input flex w-full items-center gap-2">
      <Icon icon={MapPoint} />
      <span class="min-w-0 grow truncate">{location}</span>
      <Button
        class="button button-ghost button-xs button-square"
        aria-label="Clear location"
        onclick={clear}>
        <Icon size={4} icon={CloseCircle} />
      </Button>
    </div>
    {#if place}
      <select
        class="select input"
        aria-label="How much of your location to show"
        bind:value={granularity}
        onchange={changeGranularity}>
        {#each placeGranularities(place) as option (option)}
          <option value={option}>{granularityLabels[option]}</option>
        {/each}
      </select>
    {/if}
  </div>
{:else}
  <div class="flex flex-col gap-2">
    <label class="input flex w-full items-center gap-2">
      <Icon icon={Magnifier} />
      <input
        bind:value={term}
        oninput={onInput}
        class="min-w-0 grow"
        type="text"
        placeholder="Search for a town, city, or country..." />
      <Spinner {loading} />
    </label>
    {#if failed}
      <p class="text-sm text-error">Location search is unavailable right now.</p>
    {:else if results.length > 0}
      <ul bind:this={list} class="menu bg-surface max-h-60 gap-1 overflow-auto rounded-2xl p-2">
        {#each results as result (result.latitude + "," + result.longitude)}
          <li>
            <Button class="w-full text-left" onclick={() => pick(result)}>
              <Icon size={4} icon={MapPoint} />
              {fullName(result)}
            </Button>
          </li>
        {/each}
      </ul>
    {/if}
  </div>
{/if}
