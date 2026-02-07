<script lang="ts">
  import {onMount} from "svelte"
  import {readable} from "svelte/store"
  import type {Readable} from "svelte/store"
  import {page} from "$app/stores"
  import {sortBy, partition, spec, pushToMapKey, max} from "@welshman/lib"
  import type {TrustedEvent} from "@welshman/util"
  import {ZAP_GOAL, getTagValue} from "@welshman/util"
  import {fly} from "@lib/transition"
  import NotesMinimalistic from "@assets/icons/notes-minimalistic.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import PageBar from "@lib/components/PageBar.svelte"
  import PageContent from "@lib/components/PageContent.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import SpaceMenuButton from "@app/components/SpaceMenuButton.svelte"
  import GoalItem from "@app/components/GoalItem.svelte"
  import GoalCreate from "@app/components/GoalCreate.svelte"
  import {decodeRelay, makeCommentFilter} from "@app/core/state"
  import {makeFeed} from "@app/core/requests"
  import {pushModal} from "@app/util/modal"

  const url = decodeRelay($page.params.relay!)

  let loading = $state(true)
  let element: HTMLElement | undefined = $state()
  let events: Readable<TrustedEvent[]> = $state(readable([]))

  const createGoal = () => pushModal(GoalCreate, {url})

  const items = $derived.by(() => {
    const scores = new Map<string, number[]>()
    const [goals, comments] = partition(spec({kind: ZAP_GOAL}), $events)

    for (const comment of comments) {
      const id = getTagValue("E", comment.tags)

      if (id) {
        pushToMapKey(scores, id, comment.created_at)
      }
    }

    return sortBy(e => -max([...(scores.get(e.id) || []), e.created_at]), goals)
  })

  onMount(() => {
    const feed = makeFeed({
      url,
      element: element!,
      filters: [{kinds: [ZAP_GOAL]}, makeCommentFilter([ZAP_GOAL])],
      onExhausted: () => {
        loading = false
      },
    })

    events = feed.events

    return () => {
      feed.cleanup()
    }
  })
</script>

<PageBar>
  {#snippet icon()}
    <div class="center">
      <Icon icon={NotesMinimalistic} />
    </div>
  {/snippet}
  {#snippet title()}
    <strong>Goals</strong>
  {/snippet}
  {#snippet action()}
    <div class="row-2">
      <Button class="btn btn-primary btn-sm" onclick={createGoal}>
        <Icon icon={NotesMinimalistic} />
        Create a Goal
      </Button>
      <SpaceMenuButton {url} />
    </div>
  {/snippet}
</PageBar>

<PageContent bind:element class="flex flex-col gap-2 p-2 pt-4">
  {#each items as event (event.id)}
    <div in:fly>
      <GoalItem {url} event={$state.snapshot(event)} />
    </div>
  {/each}
  <p class="flex h-10 items-center justify-center py-20">
    <Spinner {loading}>
      {#if loading}
        Looking for goals...
      {:else if items.length === 0}
        No goals found.
      {:else}
        That's all!
      {/if}
    </Spinner>
  </p>
</PageContent>
