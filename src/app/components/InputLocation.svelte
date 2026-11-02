<script lang="ts">
  import {debounce} from "throttle-debounce"
  import MapPoint from "@assets/icons/map-point.svg?dataurl"
  import CloseCircle from "@assets/icons/close-circle.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import {displayPlace, placeGeohash, searchPlaces} from "@app/features/location"
  import type {Place} from "@app/features/location"

  type Props = {
    location?: string
    geohash?: string
  }

  let {location = $bindable(), geohash = $bindable()}: Props = $props()

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
    location = displayPlace(picked)
    geohash = placeGeohash(picked)
    term = ""
    results = []
  }

  const clear = () => {
    location = undefined
    geohash = undefined
  }

  let term = $state("")
  let results: Place[] = $state([])
  let loading = $state(false)
  let failed = $state(false)
  let list: HTMLElement | undefined = $state()

  // The field sits deep enough in the form that results can open below the fold.
  $effect(() => {
    if (results.length > 0) {
      list?.scrollIntoView({block: "nearest"})
    }
  })
</script>

{#if location}
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
{:else}
  <div class="flex flex-col gap-2">
    <label class="input flex w-full items-center gap-2">
      <Icon icon={MapPoint} />
      <input
        bind:value={term}
        oninput={onInput}
        class="min-w-0 grow"
        type="text"
        placeholder="Search for a city, state, or country..." />
      <Spinner {loading} />
    </label>
    {#if failed}
      <p class="text-sm text-error">Location search is unavailable right now.</p>
    {:else if results.length > 0}
      <ul bind:this={list} class="menu bg-surface max-h-60 gap-1 overflow-auto rounded-2xl p-2">
        {#each results as result (displayPlace(result))}
          <li>
            <Button class="w-full text-left" onclick={() => pick(result)}>
              <Icon size={4} icon={MapPoint} />
              {displayPlace(result)}
            </Button>
          </li>
        {/each}
      </ul>
    {/if}
  </div>
{/if}
