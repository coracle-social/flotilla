<script lang="ts">
  import {onDestroy, onMount} from "svelte"
  import {sortBy, uniqBy} from "@welshman/lib"
  import {feedFromFilter, makeIntersectionFeed, makeRelayFeed} from "@welshman/feeds"
  import {NOTE} from "@welshman/util"
  import type {TrustedEvent} from "@welshman/util"
  import {getReplyTags} from "@welshman/domain"
  import {Feeds} from "@welshman/app"
  import {createScroller} from "@lib/html"
  import {fly} from "@lib/transition"
  import Spinner from "@lib/components/Spinner.svelte"
  import NoteItem from "@app/components/NoteItem.svelte"
  import {app} from "@app/core/app"
  import {makeFeedContext} from "@app/features/feeds"

  type Props = {
    url: string
    pubkey: string
    events?: TrustedEvent[]
    hideLoading?: boolean
  }

  let {url, pubkey, events = $bindable([]), hideLoading = false}: Props = $props()

  const context = makeFeedContext({relays: [url]})

  onDestroy(context.cleanup)

  const ctrl = $app.use(Feeds).makeFeedController({
    useWindowing: true,
    feed: makeIntersectionFeed(
      makeRelayFeed(url),
      feedFromFilter({kinds: [NOTE], authors: [pubkey]}),
    ),
    onEvent: (event: TrustedEvent) => {
      if (getReplyTags(event.tags).replies.length === 0) {
        buffer.push(event)
        context.add(event)
      }
    },
  })

  let element: Element | undefined = $state()
  let buffer: TrustedEvent[] = []

  onMount(() => {
    const scroller = createScroller({
      element: element!,
      delay: 300,
      threshold: 3000,
      onScroll: () => {
        buffer = uniqBy(
          e => e.id,
          sortBy(e => -e.created_at, buffer),
        )

        events = uniqBy(e => e.id, [...events, ...buffer.splice(0, 5)])

        if (buffer.length < 50) {
          ctrl.load(50)
        }
      },
    })

    return () => scroller.stop()
  })
</script>

<div class="flex flex-col gap-4" bind:this={element}>
  <div class="flex flex-col gap-2">
    {#each events as event (event.id)}
      <div in:fly>
        <NoteItem {url} {event} {context} />
      </div>
    {/each}
    {#if !hideLoading}
      <p class="justify-center items-center my-12 flex">
        <Spinner loading />
      </p>
    {/if}
  </div>
</div>
