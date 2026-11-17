<script lang="ts">
  import {onDestroy, onMount} from "svelte"
  import cx from "classnames"
  import {goto} from "$app/navigation"
  import {page} from "$app/stores"
  import {sortBy} from "@welshman/lib"
  import {CLASSIFIED} from "@welshman/util"
  import {Classified} from "@welshman/domain"
  import {fly} from "@lib/transition"
  import CaseMinimalistic from "@assets/icons/case-minimalistic.svg?dataurl"
  import Add from "@assets/icons/add.svg?dataurl"
  import Magnifier from "@assets/icons/magnifier.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import SegmentedButtons from "@lib/components/SegmentedButtons.svelte"
  import PageContent from "@lib/components/PageContent.svelte"
  import {followScroll} from "@lib/pager"
  import FeedFooter from "@app/components/FeedFooter.svelte"
  import SpaceBar from "@app/components/SpaceBar.svelte"
  import ClassifiedItem from "@app/components/ClassifiedItem.svelte"
  import ClassifiedCreate from "@app/components/ClassifiedCreate.svelte"
  import {partitionByActivity} from "@app/features/spaces"
  import {makeSpaceFeed} from "@app/features/feeds"
  import * as pages from "@app/navigation/pages"
  import {
    CLASSIFIED_STATUS_TABS,
    deriveTopicCounts,
    getStatus,
    matchesTopic,
    matchesQuery,
  } from "@app/features/spaces/classifieds"
  import {reader} from "@app/core/domain"
  import {pushModal} from "@app/navigation/dialogs"
  import type {PageProps} from "./$types"

  const {params}: PageProps = $props()

  const {url} = pages.classifieds.decode(params)
  const feed = makeSpaceFeed(url, CLASSIFIED)
  const {events, interactions} = feed
  const status = feed.older.status

  const createClassified = () => pushModal(ClassifiedCreate, {url})

  const setTopic = (value?: string) => () => {
    const path = pages.classifieds.path({url, topic: value || undefined})

    goto(path, {replaceState: true, noScroll: true})
  }

  let tab = $state("all")
  let sort = $state("active")
  let query = $state("")
  let element: HTMLElement | undefined = $state()

  const topic = $derived($page.url.searchParams.get("topic") ?? "")

  const {items: listings, activeAt} = $derived(partitionByActivity(CLASSIFIED, $events))
  const topicCounts = $derived(deriveTopicCounts(listings))

  // Narrowed by everything except the status tab, so its counts match what it shows.
  const scoped = $derived(
    listings.filter(event => matchesQuery(event, query) && matchesTopic(event, topic)),
  )

  const tabs = $derived(
    CLASSIFIED_STATUS_TABS.map(({value, label}) => ({
      value,
      label,
      count: scoped.filter(event => value === "all" || getStatus(event) === value).length,
    })),
  )

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

  onMount(() => followScroll(element!, feed.older))

  onDestroy(feed.stop)
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
      <SegmentedButtons options={tabs} bind:value={tab} class="shrink-0" />
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
        <ClassifiedItem {url} {interactions} event={$state.snapshot(event)} />
      </div>
    {/each}
  </div>
  {#if $status === "exhausted" && listings.length === 0}
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
    <FeedFooter
      status={$status}
      isEmpty={items.length === 0}
      loadingMessage="Looking for listings..."
      emptyMessage="No listings match your filters."
      doneMessage="That's all!" />
  {/if}
</PageContent>
