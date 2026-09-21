<script lang="ts">
  import {onMount} from "svelte"
  import {goto} from "$app/navigation"
  import {page} from "$app/stores"
  import {derived} from "svelte/store"
  import {PIN, PINBOARD} from "@welshman/util"
  import {Pins} from "@welshman/app"
  import {Pinboard} from "@welshman/domain"
  import type {PinboardReader} from "@welshman/domain"
  import Magnifier from "@assets/icons/magnifier.svg?dataurl"
  import GalleryWide from "@assets/icons/gallery-wide.svg?dataurl"
  import Add from "@assets/icons/add.svg?dataurl"
  import AddCircle from "@assets/icons/add-circle.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import PageContent from "@lib/components/PageContent.svelte"
  import Masonry from "@lib/components/Masonry.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import SpaceBar from "@app/components/SpaceBar.svelte"
  import PinItem from "@app/components/PinItem.svelte"
  import PinAdd from "@app/components/PinAdd.svelte"
  import PinboardItem from "@app/components/PinboardItem.svelte"
  import PinboardEdit from "@app/components/PinboardEdit.svelte"
  import {app, network, reader} from "@app/core"
  import {decodeRelay} from "@app/relays"
  import {deriveEventsForUrl} from "@app/repository"
  import {makeLibraryPath} from "@app/routes"
  import {pushModal} from "@app/modal"
  import type {PageProps} from "./$types"

  const {params}: PageProps = $props()

  const url = decodeRelay(params.relay)

  let term = $state("")
  let loading = $state(true)

  // A shelf belongs to the space it was published to, so the relay it was seen on
  // scopes it rather than the pubkey that signed it.
  const boards = derived(deriveEventsForUrl(url, [{kinds: [PINBOARD]}]), $events =>
    $events.map(reader(Pinboard)),
  )

  const address = $derived($page.url.searchParams.get("board") ?? "")

  const selected = $derived($boards.find(board => board.address() === address))

  const pins = $derived($app.use(Pins).forBoard(address).$)

  const filtered = $derived.by(() => {
    const value = term.trim().toLowerCase()

    if (value) {
      return $boards.filter(board =>
        [board.title(), board.description(), ...board.topics()].some(field =>
          field?.toLowerCase().includes(value),
        ),
      )
    }

    return $boards
  })

  const createBoard = () => pushModal(PinboardEdit, {url})

  const addLink = () => pushModal(PinAdd, {url, address})

  const selectBoard = (board: PinboardReader) =>
    goto(makeLibraryPath(url, board.address()), {replaceState: true, noScroll: true})

  onMount(() => {
    const controller = new AbortController()

    $network
      .loadLenient({relays: [url], filters: [{kinds: [PINBOARD, PIN]}], signal: controller.signal})
      .then(() => {
        loading = false
      })

    return () => controller.abort()
  })
</script>

<SpaceBar>
  {#snippet leading()}
    <Icon icon={GalleryWide} />
  {/snippet}
  {#snippet title()}
    <strong>Library</strong>
  {/snippet}
  {#snippet action()}
    <Button class="button button-primary button-sm" onclick={createBoard}>
      <Icon icon={Add} />
      Create Shelf
    </Button>
  {/snippet}
</SpaceBar>

<PageContent class="flex flex-col gap-4 p-4">
  <label class="card input input-group flex w-full items-center gap-2">
    <Icon size={4} icon={Magnifier} />
    <input bind:value={term} class="min-w-0 grow" type="text" placeholder="Search library..." />
  </label>
  {#if loading}
    <p class="flex items-center justify-center py-20">
      <Spinner loading>Loading library...</Spinner>
    </p>
  {:else}
    {#if filtered.length > 0}
      <div class="scroll-container flex shrink-0 gap-3 overflow-x-auto pb-2">
        {#each filtered as board (board.address())}
          <PinboardItem
            {url}
            {board}
            selected={board.address() === address}
            onclick={() => selectBoard(board)} />
        {/each}
      </div>
    {:else}
      <p class="py-8 text-center opacity-70">No shelves found.</p>
    {/if}
    <div class="divider shrink-0"></div>
    {#if selected && $pins.length > 0}
      <Masonry items={$pins} getKey={pin => pin.id()} columnWidth={80} gap={3}>
        {#snippet child(pin)}
          <PinItem {url} {pin} />
        {/snippet}
      </Masonry>
    {:else if selected}
      <div class="flex flex-col items-center gap-4 py-20 text-center">
        <p class="opacity-70">This shelf doesn't have any links yet.</p>
        <Button class="button button-primary" onclick={addLink}>
          <Icon icon={AddCircle} />
          Add a link
        </Button>
      </div>
    {:else}
      <p class="py-20 text-center opacity-70">Select a shelf to see what's on it.</p>
    {/if}
  {/if}
</PageContent>
