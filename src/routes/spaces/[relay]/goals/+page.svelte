<script lang="ts">
  import {onDestroy, onMount} from "svelte"
  import {readable} from "svelte/store"
  import type {Readable} from "svelte/store"
  import {equals, pluck, spec} from "@welshman/lib"
  import type {Maybe} from "@welshman/lib"
  import type {TrustedEvent} from "@welshman/util"
  import {ZAP_GOAL} from "@welshman/util"
  import {fly} from "@lib/transition"
  import StarFallMinimalistic from "@assets/icons/star-fall-minimalistic.svg?dataurl"
  import Add from "@assets/icons/add.svg?dataurl"
  import Bolt from "@assets/icons/bolt.svg?dataurl"
  import Confetti from "@assets/icons/confetti.svg?dataurl"
  import UsersGroupRounded from "@assets/icons/users-group-rounded.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import SegmentedButtons from "@lib/components/SegmentedButtons.svelte"
  import type {SegmentedOption} from "@lib/components/SegmentedButtons.svelte"
  import PageContent from "@lib/components/PageContent.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import SpaceBar from "@app/components/SpaceBar.svelte"
  import GoalItem from "@app/components/GoalItem.svelte"
  import GoalCreate from "@app/components/GoalCreate.svelte"
  import {decodeRelay} from "@app/core/relays"
  import {makeCommentFilter, partitionByActivity} from "@app/features/content"
  import {isFeedLoading, makeFeed, makeFeedContext, makeScrollLoader} from "@app/features/feeds"
  import {deriveGoalProgressById, filterGoals, getGoalTotals, sortGoals} from "@app/features/goals"
  import type {GoalFilter, GoalSort} from "@app/features/goals"
  import {pushModal} from "@app/ui/modal"
  import type {PageProps} from "./$types"

  const {params}: PageProps = $props()

  const url = decodeRelay(params.relay)
  const context = makeFeedContext({relays: [url]})

  onDestroy(context.cleanup)

  const tabs: SegmentedOption<GoalFilter>[] = [
    {value: "all", label: "All"},
    {value: "live", label: "Live"},
    {value: "funded", label: "Funded"},
    {value: "ended", label: "Ended"},
  ]

  let older: Maybe<ReturnType<typeof makeScrollLoader>> = $state()

  const loading = $derived(isFeedLoading($older))
  const exhausted = $derived($older?.status === "exhausted")
  let element: HTMLElement | undefined = $state()
  let events: Readable<TrustedEvent[]> = $state(readable([]))

  const createGoal = () => pushModal(GoalCreate, {url})

  let tab: GoalFilter = $state("all")
  let sort: GoalSort = $state("active")

  // progressById resubscribes every goal's zap receipts, so goals change only with the goal set.
  let goals: TrustedEvent[] = $state([])

  $effect(() => {
    const next = $events.filter(spec({kind: ZAP_GOAL}))

    if (!equals(pluck("id", next), pluck("id", goals))) {
      goals = next
    }
  })

  const progressById = $derived(deriveGoalProgressById(goals, url))
  const {activeAt} = $derived(partitionByActivity(ZAP_GOAL, $events))
  const totals = $derived(getGoalTotals($progressById))
  const items = $derived(
    sortGoals(sort, filterGoals(tab, goals, $progressById), $progressById, activeAt),
  )

  onMount(() => {
    const feed = makeFeed({
      relays: [url],
      onEvent: context.add,
      filters: [{kinds: [ZAP_GOAL]}, makeCommentFilter([ZAP_GOAL])],
    })

    events = feed.events

    // These lists are newest first, so the bottom is the oldest thing loaded.
    older = makeScrollLoader(element!, feed.loadOlder)

    return () => {
      older?.stop()
      feed.cleanup()
    }
  })
</script>

<SpaceBar>
  {#snippet leading()}
    <Icon icon={StarFallMinimalistic} />
  {/snippet}
  {#snippet title()}
    <strong>Goals</strong>
  {/snippet}
  {#snippet action()}
    <Button class="button button-primary button-sm" onclick={createGoal}>
      <Icon icon={Add} />
      Create
    </Button>
  {/snippet}
</SpaceBar>

<PageContent bind:element class="@container flex flex-col gap-3 p-2 sm:gap-4 sm:p-4">
  {#if goals.length > 0}
    <div class="grid grid-cols-3 gap-2 card card-primary card-sm bg-surface w-full text-center">
      <div class="flex flex-col items-center gap-1">
        <Icon icon={Bolt} class="text-primary" />
        <span class="text-xl font-bold">{totals.raised.toLocaleString()}</span>
        <span class="text-xs text-content-muted">sats raised</span>
      </div>
      <div class="flex flex-col items-center gap-1">
        <Icon icon={UsersGroupRounded} class="text-primary" />
        <span class="text-xl font-bold">{totals.backers}</span>
        <span class="text-xs text-content-muted">
          {totals.backers === 1 ? "backer" : "backers"}
        </span>
      </div>
      <div class="flex flex-col items-center gap-1">
        <Icon icon={Confetti} class="text-primary" />
        <span class="text-xl font-bold">{totals.funded}/{goals.length}</span>
        <span class="text-xs text-content-muted">funded</span>
      </div>
    </div>
    <div class="flex flex-wrap items-center justify-between gap-2">
      <SegmentedButtons options={tabs} bind:value={tab} class="flex-wrap" />
      <select class="select input input-sm w-auto" bind:value={sort}>
        <option value="active">Recently active</option>
        <option value="new">Newest</option>
        <option value="progress">Closest to goal</option>
        <option value="ending">Ending soonest</option>
      </select>
    </div>
  {/if}
  <div class="columns-1 gap-2 sm:gap-4 @2xl:columns-2 @6xl:columns-3">
    {#each items as event (event.id)}
      <div in:fly class="mb-2 min-w-0 break-inside-avoid sm:mb-4">
        <GoalItem {url} {context} event={$state.snapshot(event)} />
      </div>
    {/each}
  </div>
  {#if exhausted && goals.length === 0}
    <div class="flex flex-col items-center gap-3 card w-full py-16 text-center">
      <Icon icon={StarFallMinimalistic} size={10} class="text-primary" />
      <h2 class="text-xl font-bold">No funding goals yet</h2>
      <p class="text-content-muted">
        Funding goals let this space rally sats behind something worth doing.
      </p>
      <Button class="button button-primary" onclick={createGoal}>
        <Icon icon={Add} />
        Start the first one
      </Button>
    </div>
  {:else}
    <p class="flex h-10 items-center justify-center py-20">
      <Spinner {loading}>
        {#if loading}
          Looking for goals...
        {:else if exhausted && items.length === 0}
          No goals match this filter.
        {:else if exhausted}
          That's all!
        {/if}
      </Spinner>
    </p>
  {/if}
</PageContent>
