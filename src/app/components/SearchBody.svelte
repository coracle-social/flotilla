<script lang="ts">
  import type {Snippet} from "svelte"
  import {onMount, tick} from "svelte"
  import {debounce} from "throttle-debounce"
  import {formatTimestampRelative, groupBy, now, uniqBy, DAY, WEEK} from "@welshman/lib"
  import type {Filter, TrustedEvent} from "@welshman/util"
  import {sortEventsDesc} from "@welshman/util"
  import Magnifier from "@assets/icons/magnifier.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import Button from "@lib/components/Button.svelte"
  import Badge from "@lib/components/Badge.svelte"
  import ModalBody from "@lib/components/ModalBody.svelte"
  import PeopleItem from "@app/components/PeopleItem.svelte"
  import NoteCard from "@app/components/NoteCard.svelte"
  import NoteContentMinimal from "@app/components/NoteContentMinimal.svelte"
  import {getEventsForUrl} from "@app/repository"
  import {network, profiles} from "@app/core"
  import {popModal} from "@app/modal"
  import {pushToast} from "@app/toast"
  import {goToEvent} from "@app/routes"

  type Props = {
    placeholder: string
    relays: string[]
    filter: Filter
    url?: string
    members?: string[]
    badges?: Snippet<[TrustedEvent]>
    empty?: Snippet
  }

  const {placeholder, relays, filter, url, members, badges, empty}: Props = $props()

  const profileSearch = $profiles.profileSearch

  let term = $state("")
  let results = $state<TrustedEvent[]>([])
  let loading = $state(false)
  let input: HTMLInputElement | undefined = $state()
  let controller: AbortController | undefined

  const doSearch = debounce(300, async (searchTerm: string, controller: AbortController) => {
    if (!searchTerm?.trim()) {
      loading = false
      results = []
      return
    }

    const filters = [{...filter, search: searchTerm.trim()}]

    results = sortEventsDesc(
      uniqBy(
        (e: TrustedEvent) => e.id,
        relays.flatMap(relay => Array.from(getEventsForUrl(relay, filters))),
      ),
    )

    try {
      const events = await $network.loadComplete({relays, filters, signal: controller.signal})

      results = sortEventsDesc(uniqBy((e: TrustedEvent) => e.id, [...events, ...results]))
    } catch (error) {
      // Superseded searches abort; the search that replaced this one owns loading from here
      if (error instanceof DOMException && error.name === "AbortError") {
        return
      }

      console.error(error)
      pushToast({theme: "error", message: "Something went wrong while searching."})
    }

    loading = false
  })

  const onInput = () => {
    loading = true
    controller?.abort()
    controller = new AbortController()
    doSearch(term, controller)
  }

  // The modal container ignores Escape inside a text field.
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      popModal()
    }
  }

  const getAgeSection = (createdAt: number) => {
    const age = now() - createdAt

    if (age <= DAY) {
      return "day"
    }

    if (age <= WEEK) {
      return "week"
    }

    return "older"
  }

  const onResultClick = (event: TrustedEvent) => {
    popModal()
    goToEvent(event, {keepFocus: true})
  }

  const people = $derived.by(() => {
    const memberSet = members && new Set(members)
    // An empty term matches every profile there is, which is not what an unused search looks like
    const matches = term ? $profileSearch.searchValues(term) : []

    return matches.filter(pubkey => !memberSet || memberSet.has(pubkey)).slice(0, 10)
  })

  const eventsByAge = $derived(groupBy(e => getAgeSection(e.created_at), results))

  onMount(() => {
    tick().then(() => input?.focus())

    return () => controller?.abort()
  })
</script>

<ModalBody>
  <label class="input input-sm input-group flex w-full items-center gap-2">
    <Icon size={4} icon={Magnifier} />
    <input
      bind:this={input}
      bind:value={term}
      class="min-w-0 grow"
      type="text"
      {placeholder}
      oninput={onInput}
      onkeydown={onKeyDown} />
  </label>
  {#if term}
    {#if people.length > 0}
      <p class="text-xs uppercase tracking-wide opacity-60">People</p>
      {#each people as pubkey (pubkey)}
        <PeopleItem {pubkey} {url} />
      {/each}
    {/if}
    {#if loading}
      <Spinner {loading} class="justify-center py-12">Searching...</Spinner>
    {:else if results.length === 0 && people.length === 0}
      <Spinner {loading} class="justify-center py-12">No results found.</Spinner>
    {:else}
      {#each eventsByAge as [key, events] (key)}
        <p class="text-xs uppercase tracking-wide opacity-60">
          {#if key === "day"}
            Last 24 Hours
          {:else if key === "week"}
            Last 7 Days
          {:else}
            Older
          {/if}
        </p>
        {#each events as event (event.id)}
          <Button
            class="card card-sm card-interactive flex flex-col gap-2"
            onclick={() => onResultClick(event)}>
            <NoteCard minimal {event} {url}>
              <NoteContentMinimal {event} />
            </NoteCard>
            <div class="flex gap-2">
              <Badge variant="neutral">
                {formatTimestampRelative(event.created_at)}
              </Badge>
              {@render badges?.(event)}
            </div>
          </Button>
        {/each}
      {/each}
    {/if}
  {:else}
    {@render empty?.()}
  {/if}
</ModalBody>
