<script lang="ts">
  import {onDestroy} from "svelte"
  import {derived} from "svelte/store"
  import {DAY, formatTimestampRelative, now, sleep} from "@welshman/lib"
  import {ZapGoal} from "@welshman/domain"
  import Bolt from "@assets/icons/bolt.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import PageContent from "@lib/components/PageContent.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import SpaceBar from "@app/components/SpaceBar.svelte"
  import Content from "@app/components/Content.svelte"
  import NoteCard from "@app/components/NoteCard.svelte"
  import ProfileCircles from "@app/components/ProfileCircles.svelte"
  import RoomLink from "@app/components/RoomLink.svelte"
  import ZapButton from "@app/components/ZapButton.svelte"
  import GoalActions from "@app/components/GoalActions.svelte"
  import GoalMeter from "@app/components/GoalMeter.svelte"
  import GoalStatus from "@app/components/GoalStatus.svelte"
  import GoalSupporters from "@app/components/GoalSupporters.svelte"
  import EventComments from "@app/components/EventComments.svelte"
  import {reader} from "@app/core"
  import {ENABLE_ZAPS} from "@app/env"
  import {deriveGoalProgress} from "@app/goals"
  import {deriveEvent} from "@app/repository"
  import {makeFeedContext} from "@app/feeds"
  import {decodeRelay} from "@app/relays"
  import type {PageProps} from "./$types"

  const {params}: PageProps = $props()

  const {relay, id} = params
  const url = decodeRelay(relay)
  const context = makeFeedContext({relays: [url]})
  const event = deriveEvent(id, [url])
  const goal = derived(event, $event => ($event ? reader(ZapGoal)($event) : undefined))
  const progress = $derived($event ? deriveGoalProgress($event, url) : undefined)
  const remaining = $derived($progress ? Math.max(0, $progress.target - $progress.raised) : 0)
  const deadline = $derived($progress?.isEnded ? undefined : $progress?.closedAt)

  const days = $derived(
    deadline
      ? Math.ceil((deadline - now()) / DAY)
      : Math.ceil((now() - ($event?.created_at ?? now())) / DAY),
  )

  const back = () => history.back()

  onDestroy(context.cleanup)
</script>

<SpaceBar {back}>
  {#snippet title()}
    <h1 class="truncate text-xl">{$goal?.title() ?? "Funding goal"}</h1>
  {/snippet}
</SpaceBar>

<PageContent class="flex flex-col gap-3 p-2 sm:gap-4 sm:p-4">
  {#if $event && $goal && $progress}
    <NoteCard event={$event} {url} class="card z-feature w-full">
      <div class="flex flex-col gap-4">
        {#if $goal.image()}
          <img src={$goal.image()} alt="" class="h-56 w-full max-w-full rounded-2xl object-cover" />
        {/if}
        <div class="flex flex-col gap-2">
          <h2 class="wrap-break-word text-3xl">{$goal.title()}</h2>
          <div class="flex flex-wrap items-center gap-2 text-sm text-content-muted">
            <GoalStatus progress={$progress} />
            {#if $goal.room()}
              <span>in <RoomLink {url} h={$goal.room()!} /></span>
            {/if}
            <span>started {formatTimestampRelative($event.created_at)}</span>
          </div>
        </div>
        <GoalMeter progress={$progress} />
        <div class="grid grid-cols-3 gap-2 text-center">
          <div class="flex flex-col items-center gap-1 rounded-2xl bg-surface-more p-3">
            <span class="text-xl font-bold">{$progress.backers.length}</span>
            {#if $progress.backers.length > 0}
              <ProfileCircles pubkeys={$progress.backers} size={5} limit={5} />
            {/if}
            <span class="text-xs text-content-muted">
              {$progress.backers.length === 1 ? "backer" : "backers"}
            </span>
          </div>
          <div class="flex flex-col items-center gap-1 rounded-2xl bg-surface-more p-3">
            <span class="text-xl font-bold">{remaining.toLocaleString()}</span>
            <span class="text-xs text-content-muted">sats to go</span>
          </div>
          <div class="flex flex-col items-center gap-1 rounded-2xl bg-surface-more p-3">
            <span class="text-xl font-bold">{$progress.isEnded ? "—" : days}</span>
            <span class="text-xs text-content-muted">
              {#if $progress.isEnded && $progress.closedAt}
                ended {formatTimestampRelative($progress.closedAt)}
              {:else if deadline}
                {days === 1 ? "day" : "days"} left
              {:else}
                {days === 1 ? "day" : "days"} running
              {/if}
            </span>
          </div>
        </div>
        {#if ENABLE_ZAPS && !$progress.isEnded}
          <ZapButton {url} event={$event} class="button button-primary button-block lg:px-20">
            <Icon icon={Bolt} />
            {$progress.isFunded ? "Chip in anyway" : "Contribute to this goal"}
          </ZapButton>
        {/if}
        <GoalActions event={$event} {url} {context} />
      </div>
    </NoteCard>
    {#if $goal.summary()}
      <div class="flex flex-col gap-3 card w-full">
        <h2 class="text-lg font-bold">About this goal</h2>
        <Content showEntire event={{content: $goal.summary(), tags: $event.tags}} {url} />
      </div>
    {/if}
    <GoalSupporters {url} event={$event} progress={$progress} />
    <EventComments event={$event} {url} {context} />
  {:else}
    <div class="flex justify-center py-20">
      {#await sleep(5000)}
        <Spinner loading>Loading funding goal...</Spinner>
      {:then}
        <p>Failed to load funding goal.</p>
      {/await}
    </div>
  {/if}
</PageContent>
