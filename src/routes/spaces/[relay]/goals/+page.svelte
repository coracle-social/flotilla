<script lang="ts">
  import {onDestroy, onMount} from "svelte"
  import {derived, readable} from "svelte/store"
  import type {Readable} from "svelte/store"
  import cx from "classnames"
  import {equals, max, now, pluck, sortBy, spec} from "@welshman/lib"
  import type {Maybe} from "@welshman/lib"
  import type {TrustedEvent} from "@welshman/util"
  import {ZAP_GOAL, tagSpec, tagValue} from "@welshman/util"
  import {fly} from "@lib/transition"
  import StarFallMinimalistic from "@assets/icons/star-fall-minimalistic.svg?dataurl"
  import Add from "@assets/icons/add.svg?dataurl"
  import Bolt from "@assets/icons/bolt.svg?dataurl"
  import Confetti from "@assets/icons/confetti.svg?dataurl"
  import UsersGroupRounded from "@assets/icons/users-group-rounded.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import PageContent from "@lib/components/PageContent.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import SpaceBar from "@app/components/SpaceBar.svelte"
  import GoalItem from "@app/components/GoalItem.svelte"
  import GoalCreate from "@app/components/GoalCreate.svelte"
  import {decodeRelay} from "@app/relays"
  import {makeCommentFilter} from "@app/content"
  import {isFeedLoading, makeFeed, makeFeedContext, makeScrollLoader} from "@app/feeds"
  import {deriveGoalProgress} from "@app/goals"
  import type {GoalProgress} from "@app/goals"
  import {pushModal} from "@app/modal"
  import type {PageProps} from "./$types"

  const {params}: PageProps = $props()

  const url = decodeRelay(params.relay)
  const context = makeFeedContext({relays: [url]})

  onDestroy(context.cleanup)

  const tabs = [
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

  let tab = $state("all")
  let sort = $state("active")

  // progressById resubscribes every goal's zap receipts, so these change only with the goal set.
  let goals: TrustedEvent[] = $state([])
  let progressStoresById: Map<string, Readable<GoalProgress>> = $state(new Map())

  $effect(() => {
    const next = $events.filter(spec({kind: ZAP_GOAL}))

    if (!equals(pluck("id", next), pluck("id", goals))) {
      goals = next
      progressStoresById = new Map(
        next.map(event => [
          event.id,
          progressStoresById.get(event.id) ?? deriveGoalProgress(event, url),
        ]),
      )
    }
  })

  // `derived` over no stores never fires, so an empty board needs a store of its own.
  const progressById = $derived.by(() => {
    const ids = Array.from(progressStoresById.keys())
    const stores = Array.from(progressStoresById.values())

    return stores.length > 0
      ? derived(stores, progresses => new Map(progresses.map((progress, i) => [ids[i]!, progress])))
      : readable(new Map<string, GoalProgress>())
  })

  // A goal is "active" as of its own creation or the newest comment on it.
  const activeAt = $derived.by(() => {
    const result = new Map<string, number>()

    for (const event of $events) {
      const id = event.kind === ZAP_GOAL ? event.id : tagValue(tagSpec("E"), event.tags)

      if (id) {
        result.set(id, max([result.get(id), event.created_at]))
      }
    }

    return result
  })

  const totals = $derived.by(() => {
    const backers = new Set<string>()
    let raised = 0
    let funded = 0

    for (const progress of $progressById.values()) {
      raised += progress.raised
      funded += progress.isFunded ? 1 : 0

      for (const backer of progress.backers) {
        backers.add(backer)
      }
    }

    return {raised, funded, backers: backers.size}
  })

  const items = $derived.by(() => {
    const matches = goals.filter(event => {
      const progress = $progressById.get(event.id)

      if (tab === "live") {
        return Boolean(progress && !progress.isEnded && !progress.isFunded)
      }

      if (tab === "funded") {
        return Boolean(progress?.isFunded)
      }

      if (tab === "ended") {
        return Boolean(progress?.isEnded)
      }

      return true
    })

    if (sort === "new") {
      return sortBy(event => -event.created_at, matches)
    }

    if (sort === "progress") {
      return sortBy(event => -($progressById.get(event.id)?.percent ?? 0), matches)
    }

    if (sort === "ending") {
      return sortBy(event => {
        const closedAt = $progressById.get(event.id)?.closedAt

        return closedAt && closedAt > now() ? closedAt : Infinity
      }, matches)
    }

    return sortBy(event => -(activeAt.get(event.id) ?? event.created_at), matches)
  })

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

<PageContent bind:element class="flex flex-col gap-3 p-2 sm:gap-4 sm:p-4">
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
      <div class="flex flex-wrap gap-2">
        {#each tabs as { value, label } (value)}
          {@const onClick = () => (tab = value)}
          <Button
            aria-pressed={tab === value}
            class={cx(
              "button button-sm rounded-full",
              tab === value ? "button-primary" : "button-neutral",
            )}
            onclick={onClick}>
            {label}
          </Button>
        {/each}
      </div>
      <select class="select input input-sm w-auto" bind:value={sort}>
        <option value="active">Recently active</option>
        <option value="new">Newest</option>
        <option value="progress">Closest to goal</option>
        <option value="ending">Ending soonest</option>
      </select>
    </div>
  {/if}
  <div class="columns-1 gap-2 sm:gap-4 lg:columns-2 2xl:columns-3">
    {#each items as event (event.id)}
      <div in:fly class="mb-2 min-w-0 break-inside-avoid sm:mb-4">
        <GoalItem
          {url}
          {context}
          event={$state.snapshot(event)}
          progress={progressStoresById.get(event.id)} />
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
