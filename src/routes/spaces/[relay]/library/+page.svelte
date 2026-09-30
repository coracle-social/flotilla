<script lang="ts">
  import {onDestroy, onMount} from "svelte"
  import {max, pushToMapKey, sortBy} from "@welshman/lib"
  import {PIN, PINBOARD} from "@welshman/util"
  import type {PinReader} from "@welshman/domain"
  import Magnifier from "@assets/icons/magnifier.svg?dataurl"
  import GalleryWide from "@assets/icons/gallery-wide.svg?dataurl"
  import Add from "@assets/icons/add.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import PageContent from "@lib/components/PageContent.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import SpaceBar from "@app/components/SpaceBar.svelte"
  import PinItem from "@app/components/PinItem.svelte"
  import PinboardItem from "@app/components/PinboardItem.svelte"
  import PinboardEdit from "@app/components/PinboardEdit.svelte"
  import {network} from "@app/core"
  import {makeFeedContext} from "@app/feeds"
  import {derivePins, deriveShelves, pinMatchesTerm, shelfMatchesTerm} from "@app/pinboards"
  import {decodeRelay} from "@app/relays"
  import {pushModal} from "@app/modal"
  import type {PageProps} from "./$types"

  const {params}: PageProps = $props()

  const url = decodeRelay(params.relay)
  const context = makeFeedContext({relays: [url]})
  const shelves = deriveShelves(url)
  const pins = derivePins(url)

  const pinsByShelf = $derived.by(() => {
    const result = new Map<string, PinReader[]>()

    for (const pin of $pins) {
      for (const address of pin.boards()) {
        pushToMapKey(result, address, pin)
      }
    }

    return result
  })

  // A shelf is as recent as the newest thing on it, so curating one brings it back to the front.
  const sorted = $derived(
    sortBy(
      shelf =>
        -max([
          shelf.event.created_at,
          ...(pinsByShelf.get(shelf.address()) ?? []).map(pin => pin.event.created_at),
        ]),
      $shelves,
    ),
  )

  let search = $state("")
  let loading = $state(true)

  const term = $derived(search.trim().toLowerCase())

  const matchingShelves = $derived(
    term ? sorted.filter(shelf => shelfMatchesTerm(shelf, term)) : sorted,
  )

  const matchingPins = $derived(
    term ? $pins.filter(pin => pin.boards().length > 0 && pinMatchesTerm(pin, term)) : [],
  )

  const createShelf = () => pushModal(PinboardEdit, {url})

  onMount(() => {
    const controller = new AbortController()

    $network
      .loadLenient({relays: [url], filters: [{kinds: [PINBOARD, PIN]}], signal: controller.signal})
      .then(() => {
        loading = false
      })

    return () => controller.abort()
  })

  onDestroy(context.cleanup)
</script>

<SpaceBar>
  {#snippet leading()}
    <Icon icon={GalleryWide} />
  {/snippet}
  {#snippet title()}
    <strong>Library</strong>
  {/snippet}
  {#snippet action()}
    <Button class="button button-primary button-sm" onclick={createShelf}>
      <Icon icon={Add} />
      Create Shelf
    </Button>
  {/snippet}
</SpaceBar>

<PageContent class="@container flex flex-col gap-4 p-4">
  <label class="card input input-group flex w-full items-center gap-2">
    <Icon size={4} icon={Magnifier} />
    <input bind:value={search} class="min-w-0 grow" type="text" placeholder="Search library..." />
  </label>
  {#if loading}
    <p class="flex items-center justify-center py-20">
      <Spinner loading>Loading library...</Spinner>
    </p>
  {:else if $shelves.length === 0}
    <div class="card flex flex-col items-center gap-4 py-16 text-center">
      <p class="text-xl">This space has no shelves yet.</p>
      <p class="opacity-75">
        A shelf collects links, notes and files worth keeping where everyone can find them.
      </p>
      <Button class="button button-primary" onclick={createShelf}>
        <Icon icon={Add} />
        Create the first shelf
      </Button>
    </div>
  {:else}
    {#if matchingShelves.length > 0}
      <div class="grid gap-4 @2xl:grid-cols-2 @4xl:grid-cols-3">
        {#each matchingShelves as board (board.address())}
          <PinboardItem {url} {board} {context} pins={pinsByShelf.get(board.address()) ?? []} />
        {/each}
      </div>
    {:else}
      <p class="py-8 text-center opacity-70">No shelves match that.</p>
    {/if}
    {#if term}
      <h2 class="text-lg">
        {matchingPins.length === 1
          ? "1 link matches that"
          : `${matchingPins.length} links match that`}
      </h2>
      <div class="grid gap-4 @2xl:grid-cols-2 @4xl:grid-cols-3">
        {#each matchingPins as pin (pin.event.id)}
          <PinItem {url} {pin} {context} />
        {/each}
      </div>
    {/if}
  {/if}
</PageContent>
