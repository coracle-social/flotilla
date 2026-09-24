<script lang="ts">
  import {onDestroy, onMount} from "svelte"
  import {readable} from "svelte/store"
  import type {Readable} from "svelte/store"
  import {sortBy, partition, spec, pushToMapKey, max} from "@welshman/lib"
  import type {Maybe} from "@welshman/lib"
  import type {TrustedEvent} from "@welshman/util"
  import {POLL, tagValue, tagSpec} from "@welshman/util"
  import {fly} from "@lib/transition"
  import PollIcon from "@assets/icons/revote.svg?dataurl"
  import Add from "@assets/icons/add.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import PageContent from "@lib/components/PageContent.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import SpaceBar from "@app/components/SpaceBar.svelte"
  import PollItem from "@app/components/PollItem.svelte"
  import PollCreate from "@app/components/PollCreate.svelte"
  import {decodeRelay} from "@app/relays"
  import {makeCommentFilter} from "@app/content"
  import {isFeedLoading, makeFeed, makeFeedContext, makeScrollLoader} from "@app/feeds"
  import {pushModal} from "@app/modal"
  import type {PageProps} from "./$types"

  const {params}: PageProps = $props()

  const url = decodeRelay(params.relay)
  const context = makeFeedContext({relays: [url]})

  onDestroy(context.cleanup)

  let older: Maybe<ReturnType<typeof makeScrollLoader>> = $state()

  const loading = $derived(isFeedLoading($older))
  const exhausted = $derived($older?.status === "exhausted")
  let element: HTMLElement | undefined = $state()
  let events: Readable<TrustedEvent[]> = $state(readable([]))

  const createPoll = () => pushModal(PollCreate, {url})

  const items = $derived.by(() => {
    const scores = new Map<string, number[]>()
    const [polls, comments] = partition(spec({kind: POLL}), $events)

    for (const comment of comments) {
      const id = tagValue(tagSpec("E"), comment.tags)

      if (id) {
        pushToMapKey(scores, id, comment.created_at)
      }
    }

    return sortBy(e => -max([...(scores.get(e.id) || []), e.created_at]), polls)
  })

  onMount(() => {
    const feed = makeFeed({
      relays: [url],
      onEvent: context.add,
      filters: [{kinds: [POLL]}, makeCommentFilter([POLL])],
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
    <Icon icon={PollIcon} />
  {/snippet}
  {#snippet title()}
    <strong>Polls</strong>
  {/snippet}
  {#snippet action()}
    <Button class="button button-primary button-sm" onclick={createPoll}>
      <Icon icon={Add} />
      Create
    </Button>
  {/snippet}
</SpaceBar>

<PageContent bind:element class="flex flex-col gap-2 p-2 sm:gap-4 sm:p-4">
  {#each items as event (event.id)}
    <div in:fly>
      <PollItem {url} {context} event={$state.snapshot(event)} />
    </div>
  {/each}
  <p class="flex h-10 items-center justify-center py-20">
    <Spinner {loading}>
      {#if loading}
        Looking for polls...
      {:else if exhausted && items.length === 0}
        No polls found.
      {:else if exhausted}
        That's all!
      {/if}
    </Spinner>
  </p>
</PageContent>
