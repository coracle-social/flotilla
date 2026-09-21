<script lang="ts">
  import {onDestroy, onMount} from "svelte"
  import {readable} from "svelte/store"
  import type {Readable} from "svelte/store"
  import cx from "classnames"
  import {goto} from "$app/navigation"
  import {page} from "$app/stores"
  import {sortBy} from "@welshman/lib"
  import type {Maybe} from "@welshman/lib"
  import type {TrustedEvent} from "@welshman/util"
  import {CLASSIFIED} from "@welshman/util"
  import {Classified} from "@welshman/domain"
  import {fly} from "@lib/transition"
  import CaseMinimalistic from "@assets/icons/case-minimalistic.svg?dataurl"
  import Add from "@assets/icons/add.svg?dataurl"
  import Magnifier from "@assets/icons/magnifier.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import PageContent from "@lib/components/PageContent.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import SpaceBar from "@app/components/SpaceBar.svelte"
  import ClassifiedItem from "@app/components/ClassifiedItem.svelte"
  import ClassifiedCreate from "@app/components/ClassifiedCreate.svelte"
  import {decodeRelay} from "@app/relays"
  import {makeCommentFilter} from "@app/content"
  import {isFeedLoading, makeFeed, makeFeedContext, makeScrollLoader} from "@app/feeds"
  import {makeClassifiedPath} from "@app/routes"
  import {
    CLASSIFIED_STATUS_TABS,
    partitionListings,
    deriveTopicCounts,
    getStatus,
    matchesTopic,
    matchesQuery,
  } from "@app/classifieds"
  import {reader} from "@app/core"
  import {pushModal} from "@app/modal"
  import type {PageProps} from "./$types"

  const {params}: PageProps = $props()

  const url = decodeRelay(params.relay)
  const context = makeFeedContext({relays: [url]})

  onDestroy(context.cleanup)

  const createClassified = () => pushModal(ClassifiedCreate, {url})

  const setTopic = (value?: string) => () => {
    const path = makeClassifiedPath(url) + (value ? `?topic=${encodeURIComponent(value)}` : "")

    goto(path, {replaceState: true, noScroll: true})
  }

  const setTab = (value: string) => () => {
    tab = value
  }

  let older: Maybe<ReturnType<typeof makeScrollLoader>> = $state()

  const loading = $derived(isFeedLoading($older))
  const exhausted = $derived($older?.status === "exhausted")

  let tab = $state("all")
  let sort = $state("active")
  let query = $state("")
  let element: HTMLElement | undefined = $state()
  let events: Readable<TrustedEvent[]> = $state(readable([]))

  const topic = $derived($page.url.searchParams.get("topic") ?? "")

  const {listings, activeAt} = $derived(partitionListings($events))
  const topicCounts = $derived(deriveTopicCounts(listings))

  // Narrowed by everything except the status tab, so its counts match what it shows.
  const scoped = $derived(
    listings.filter(event => matchesQuery(event, query) && matchesTopic(event, topic)),
  )

  const counts = $derived.by(() => {
    const result: Record<string, number> = {all: scoped.length, active: 0, sold: 0}

    for (const event of scoped) {
      const status = getStatus(event)

      result[status] = (result[status] ?? 0) + 1
    }

    return result
  })

  const items = $derived.by(() => {
    const matches = scoped.filter(event => tab === "all" || getStatus(event) === tab)

    if (sort === "new") {
      return sortBy(event => -event.created_at, matches)
    }

    if (sort === "price-asc") {
      return sortBy(event => reader(Classified)(event).price()?.amount ?? Infinity, matches)
    }

    if (sort === "price-desc") {
      return sortBy(event => -(reader(Classified)(event).price()?.amount ?? -1), matches)
    }

    return sortBy(event => -(activeAt.get(event.id) ?? event.created_at), matches)
  })

  onMount(() => {
    const feed = makeFeed({
      relays: [url],
      onEvent: context.add,
      filters: [{kinds: [CLASSIFIED]}, makeCommentFilter([CLASSIFIED])],
    })

    events = feed.events

    // These lists are sorted newest first, so reaching the bottom is reaching the oldest thing
    // loaded.
    older = makeScrollLoader(element!, feed.loadOlder)

    return () => {
      older?.stop()
      feed.cleanup()
    }
  })
</script>

<SpaceBar>
  {#snippet leading()}
    <Icon icon={CaseMinimalistic} />
  {/snippet}
  {#snippet title()}
    <strong>Classifieds</strong>
  {/snippet}
  {#snippet action()}
    <Button class="button button-primary button-sm" onclick={createClassified}>
      <Icon icon={Add} />
      Create
    </Button>
  {/snippet}
</SpaceBar>

<PageContent bind:element class="@container flex flex-col gap-3 p-2 sm:gap-4 sm:p-4">
  {#if listings.length > 0}
    <div class="flex flex-wrap items-center gap-2">
      <label class="input flex w-auto min-w-48 grow items-center gap-2">
        <Icon icon={Magnifier} class="shrink-0 text-content-muted" />
        <input bind:value={query} class="grow" type="text" placeholder="Search listings..." />
      </label>
      <select class="select input w-full sm:w-auto" bind:value={sort}>
        <option value="active">Recently active</option>
        <option value="new">Newest</option>
        <option value="price-asc">Price: low to high</option>
        <option value="price-desc">Price: high to low</option>
      </select>
    </div>
    <!-- Scrolls on a phone, where wrapping this many chips would bury the listings. -->
    <div
      class="flex shrink-0 flex-nowrap items-center gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-x-visible sm:pb-0">
      {#each CLASSIFIED_STATUS_TABS as { value, label } (value)}
        <Button
          aria-pressed={tab === value}
          class={cx(
            "button button-sm shrink-0 rounded-full",
            tab === value ? "button-primary" : "button-neutral",
          )}
          onclick={setTab(value)}>
          {label}
          <span class="opacity-75">{counts[value] ?? 0}</span>
        </Button>
      {/each}
      {#if topicCounts.length > 0}
        <span class="mx-1 h-6 w-px shrink-0 bg-line"></span>
        {#each topicCounts as [value, count] (value)}
          <Button
            aria-pressed={topic === value}
            class={cx(
              "button button-sm shrink-0 rounded-full font-normal",
              topic === value ? "button-primary" : "button-neutral",
            )}
            onclick={setTopic(topic === value ? undefined : value)}>
            #{value}
            <span class="opacity-75">{count}</span>
          </Button>
        {/each}
      {/if}
    </div>
  {/if}
  <div class="grid gap-3 @2xl:grid-cols-2 @2xl:gap-4 @4xl:grid-cols-3 @7xl:grid-cols-4">
    {#each items as event (event.id)}
      <div in:fly class="h-full min-w-0">
        <ClassifiedItem {url} {context} event={$state.snapshot(event)} />
      </div>
    {/each}
  </div>
  {#if exhausted && listings.length === 0}
    <div class="flex flex-col items-center gap-3 card w-full py-16 text-center">
      <Icon icon={CaseMinimalistic} size={10} class="text-primary" />
      <h2 class="text-xl font-bold">No listings yet</h2>
      <p class="text-content-muted">
        Classifieds let this space buy, sell, and find things together.
      </p>
      <Button class="button button-primary" onclick={createClassified}>
        <Icon icon={Add} />
        Post the first listing
      </Button>
    </div>
  {:else}
    <p class="flex h-10 items-center justify-center py-20">
      <Spinner {loading}>
        {#if loading}
          Looking for listings...
        {:else if exhausted && items.length === 0}
          No listings match your filters.
        {:else if exhausted}
          That's all!
        {/if}
      </Spinner>
    </p>
  {/if}
</PageContent>
