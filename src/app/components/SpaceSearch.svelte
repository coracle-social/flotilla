<script lang="ts">
  import {tick} from "svelte"
  import {createSearch} from "@welshman/app"
  import {formatTimestampAsDate, groupBy, now, MINUTE, HOUR, DAY, WEEK} from "@welshman/lib"
  import type {TrustedEvent} from "@welshman/util"
  import {MESSAGE} from "@welshman/util"
  import CloseCircle from "@assets/icons/close-circle.svg?dataurl"
  import Magnifier from "@assets/icons/magnifier.svg?dataurl"
  import {fly} from "@lib/transition"
  import PageContent from "@lib/components/PageContent.svelte"
  import Button from "@lib/components/Button.svelte"
  import Icon from "@lib/components/Icon.svelte"
  import {deriveEventsForUrl} from "@app/core/state"
  import {goToEvent} from "@app/util/routes"

  type Props = {
    url: string
    h?: string
  }

  const {url, h}: Props = $props()

  const spaceMessages = deriveEventsForUrl(
    url,
    h ? [{kinds: [MESSAGE], "#h": [h]}] : [{kinds: [MESSAGE]}],
  )

  let term = $state("")
  let show = $state(false)
  let input: HTMLInputElement | undefined = $state()

  const open = () => {
    show = true
    tick().then(() => input?.focus())
  }

  const close = () => {
    show = false
  }

  const clear = () => {
    term = ""
    show = false
  }

  const onInput = () => {
    show = true
  }

  const searchIndex = $derived.by(() =>
    createSearch($spaceMessages, {
      getValue: event => event.id,
      fuseOptions: {keys: ["content"]},
    }),
  )

  const results = $derived(term ? searchIndex.searchOptions(term) : [])

  const eventsByAge = $derived(groupBy(e => getAgeSection(e.created_at), results))

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

  const getAgeLabel = (createdAt: number) => {
    const age = now() - createdAt

    if (age < MINUTE) {
      return "Just now"
    }

    if (age < HOUR) {
      return `${Math.floor(age / MINUTE)}m ago`
    }

    if (age < DAY) {
      return `${Math.floor(age / HOUR)}h ago`
    }

    return `${Math.floor(age / DAY)}d ago`
  }

  const onRoomSearchResultClick = (event: TrustedEvent) => {
    close()
    void goToEvent(event, {keepFocus: true})
  }
</script>

<div>
  <button class="btn btn-neutral btn-sm btn-square" aria-label="Search" onclick={open}>
    <Icon size={4} icon={Magnifier} />
  </button>
  {#if show}
    <button class="fixed inset-0 z-feature" aria-label="Close search" onclick={close}></button>
    <div class="fixed cw top-0 right-0 z-feature p-2">
      <div
        class="card2 card2-sm bg-alt flex flex-col gap-2 shadow-md"
        transition:fly={{y: -40, duration: 150}}>
        <div class="flex justify-between">
          <strong>Search</strong>
          <Button onclick={clear}>
            <Icon icon={CloseCircle} />
          </Button>
        </div>
        <label class="input input-sm input-bordered flex w-full items-center gap-2">
          <Icon size={4} icon={Magnifier} />
          <input
            bind:this={input}
            bind:value={term}
            class="min-w-0 grow"
            type="text"
            placeholder={h ? "Search this room..." : "Search this space..."}
            oninput={onInput} />
        </label>
        <div class="max-h-[65vh] overflow-y-auto">
          {#if !term}
            <p class="text-sm opacity-70">
              {h ? "Search for messages in this room." : "Search for messages across this space."}
            </p>
          {:else if eventsByAge.size === 0}
            <p class="text-sm opacity-70">No results found.</p>
          {:else}
            <div class="col-2">
              {#each eventsByAge as [key, events] (key)}
                <div class="col-2">
                  <p class="text-xs uppercase tracking-wide opacity-60">
                    {#if key === "day"}
                      Last 24 Hours
                    {:else if key === "week"}
                      Last 7 Days
                    {:else}
                      Older
                    {/if}
                  </p>
                  <div class="col-2">
                    {#each events as event (event.id)}
                      <button
                        class="card2 bg-alt card2-sm col-2 transition-colors hover:bg-base-200 text-left"
                        onclick={() => onRoomSearchResultClick(event)}>
                        <p class="line-clamp-2 text-sm">
                          {event.content.trim() || "(No text content)"}
                        </p>
                        <div class="row-2 text-xs opacity-70">
                          <span>{getAgeLabel(event.created_at)}</span>
                          <span>{formatTimestampAsDate(event.created_at)}</span>
                        </div>
                      </button>
                    {/each}
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      </div>
    </div>
  {/if}
</div>
