<script lang="ts">
  import {onDestroy, onMount} from "svelte"
  import {readable} from "svelte/store"
  import type {Readable} from "svelte/store"
  import {page} from "$app/stores"
  import {sortBy, partition, spec, max, pushToMapKey} from "@welshman/lib"
  import type {Maybe} from "@welshman/lib"
  import type {TrustedEvent} from "@welshman/util"
  import {CLASSIFIED, tagSpec, tagValue} from "@welshman/util"
  import {fly} from "@lib/transition"
  import CaseMinimalistic from "@assets/icons/case-minimalistic.svg?dataurl"
  import Add from "@assets/icons/add.svg?dataurl"
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
  import {pushModal} from "@app/modal"

  const url = decodeRelay($page.params.relay!)
  const context = makeFeedContext({relays: [url]})

  onDestroy(context.cleanup)

  let older: Maybe<ReturnType<typeof makeScrollLoader>> = $state()

  const loading = $derived(isFeedLoading($older))
  const exhausted = $derived($older?.status === "exhausted")
  let element: HTMLElement | undefined = $state()
  let events: Readable<TrustedEvent[]> = $state(readable([]))

  const createClassified = () => pushModal(ClassifiedCreate, {url})

  const items = $derived.by(() => {
    const scores = new Map<string, number[]>()
    const [goals, comments] = partition(spec({kind: CLASSIFIED}), $events)

    for (const comment of comments) {
      const id = tagValue(tagSpec("E"), comment.tags)

      if (id) {
        pushToMapKey(scores, id, comment.created_at)
      }
    }

    return sortBy(e => -max([...(scores.get(e.id) || []), e.created_at]), goals)
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

<PageContent bind:element class="flex flex-col gap-2 p-2 sm:gap-4 sm:p-4">
  {#each items as event (event.id)}
    <div in:fly>
      <ClassifiedItem {url} {context} event={$state.snapshot(event)} />
    </div>
  {/each}
  <p class="flex h-10 items-center justify-center py-20">
    <Spinner {loading}>
      {#if loading}
        Looking for listings...
      {:else if exhausted && items.length === 0}
        No classified listings found.
      {:else if exhausted}
        That's all!
      {/if}
    </Spinner>
  </p>
</PageContent>
