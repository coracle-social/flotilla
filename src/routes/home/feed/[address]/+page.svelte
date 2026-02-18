<script lang="ts">
  import {onMount} from "svelte"
  import {writable} from "svelte/store"
  import {batch, call} from "@welshman/lib"
  import type {MakeNonOptional} from "@welshman/lib"
  import type {TrustedEvent} from "@welshman/util"
  import {makeFeedController} from "@welshman/app"
  import {page} from "$app/stores"
  import {createScroller} from "@lib/html"
  import PageBar from "@lib/components/PageBar.svelte"
  import PageContent from "@lib/components/PageContent.svelte"
  import NoteItem from "@app/components/NoteItem.svelte"
  import {deriveFeed} from "@app/core/state"

  const {address} = $page.params as MakeNonOptional<typeof $page.params>
  console.log(address)
  const events = writable<TrustedEvent[]>([])
  const controller = new AbortController()
  const feed = deriveFeed(address)
  const limit = writable(0)

  let loading = $state(true)
  let element: Element | undefined = $state()

  onMount(() => {
    if ($feed) {
      const promise = call(async () => {
        const ctrl = makeFeedController({
          useWindowing: true,
          signal: controller.signal,
          feed: $feed.definition,
          onEvent: batch(100, (evts: TrustedEvent[]) => {
            events.update($events => [...$events, ...evts])
          }),
          onExhausted: () => {
            loading = false
          },
        })

        const scroller = createScroller({
          element: element!,
          delay: 800,
          threshold: 3000,
          onScroll: async () => {
            limit.update($limit => {
              if ($events.length - $limit < 50) {
                ctrl.load(50)
              }

              return $limit + 10
            })
          },
        })

        return () => {
          scroller.stop()
          controller.abort()
        }
      })

      return () => promise.then(call)
    }
  })
</script>

{#if $feed}
  <PageBar>
    {#snippet title()}
      <h1 class="text-xl">{$feed.title}</h1>
    {/snippet}
  </PageBar>
  <PageContent class="flex flex-col gap-2 p-2 pt-4" bind:element>
    {#each $events as event (event.id)}
      <NoteItem {event} />
    {:else}
      {#if loading}
        <div class="flex justify-center items-center py-20">
          <span class="loading loading-spinner mr-3"></span>
          Loading your feed...
        </div>
      {:else}
        <p class="flex flex-col items-center py-20 text-center">No content found!</p>
      {/if}
    {/each}
  </PageContent>
{/if}
