<script lang="ts">
  import {onDestroy, onMount} from "svelte"
  import {sortBy, uniq} from "@welshman/lib"
  import {PIN, PINBOARD} from "@welshman/util"
  import {normalizeTopic} from "@lib/util"
  import AddCircle from "@assets/icons/add-circle.svg?dataurl"
  import GalleryWide from "@assets/icons/gallery-wide.svg?dataurl"
  import List from "@assets/icons/list.svg?dataurl"
  import Magnifier from "@assets/icons/magnifier.svg?dataurl"
  import Button from "@lib/components/Button.svelte"
  import Icon from "@lib/components/Icon.svelte"
  import LoadingFallback from "@lib/components/LoadingFallback.svelte"
  import MenuButton from "@lib/components/MenuButton.svelte"
  import PageContent from "@lib/components/PageContent.svelte"
  import BoardMenu from "@app/components/BoardMenu.svelte"
  import EventComments from "@app/components/EventComments.svelte"
  import PinItem from "@app/components/PinItem.svelte"
  import PinList from "@app/components/PinList.svelte"
  import PinSave from "@app/components/PinSave.svelte"
  import ProfileCircles from "@app/components/ProfileCircles.svelte"
  import ProfileList from "@app/components/ProfileList.svelte"
  import SpaceBar from "@app/components/SpaceBar.svelte"
  import {network} from "@app/core"
  import {makeFeedContext} from "@app/feeds"
  import {derivePins, deriveShelf, pinMatchesTerm} from "@app/pinboards"
  import {decodeRelay} from "@app/relays"
  import {pushModal} from "@app/modal"
  import type {PageProps} from "./$types"

  const {params}: PageProps = $props()

  const {address} = params
  const url = decodeRelay(params.relay)
  const context = makeFeedContext({relays: [url]})
  const board = deriveShelf(url, address)
  const pins = derivePins(url)

  const shelved = $derived(
    sortBy(
      pin => -pin.event.created_at,
      $pins.filter(pin => pin.boards().includes(address)),
    ),
  )

  let search = $state("")
  let layout = $state<"cards" | "list">("cards")

  const term = $derived(search.trim().toLowerCase())
  const visible = $derived(term ? shelved.filter(pin => pinMatchesTerm(pin, term)) : shelved)
  const topics = $derived(uniq(($board?.topics() ?? []).map(normalizeTopic)))
  const contributors = $derived(
    uniq([...($board ? [$board.event.pubkey] : []), ...shelved.map(pin => pin.event.pubkey)]),
  )

  const back = () => history.back()

  const addLinks = () => pushModal(PinSave, {url, address})

  const showContributors = () =>
    pushModal(ProfileList, {
      title: "Contributors",
      subtitle: "Made this shelf or added a link to it",
      pubkeys: contributors,
      url,
    })

  const toggleList = () => {
    layout = layout === "list" ? "cards" : "list"
  }

  onMount(() => {
    const controller = new AbortController()

    $network.loadLenient({
      relays: [url],
      filters: [{kinds: [PINBOARD, PIN]}],
      signal: controller.signal,
    })

    return () => controller.abort()
  })

  onDestroy(context.cleanup)
</script>

<SpaceBar {back}>
  {#snippet leading()}
    <Icon icon={GalleryWide} />
  {/snippet}
  {#snippet title()}
    <h1 class="text-xl">{$board?.title() || "Shelf"}</h1>
  {/snippet}
  {#snippet action()}
    <Button class="button button-primary button-sm" onclick={addLinks}>
      <Icon icon={AddCircle} />
      Add a link
    </Button>
    {#if $board}
      <MenuButton
        class="button button-neutral button-sm button-square"
        aria-label="Shelf options"
        iconSize={4}
        component={BoardMenu}
        componentProps={{url, board: $board}} />
    {/if}
  {/snippet}
</SpaceBar>

<PageContent noPad class="flex flex-col gap-0">
  {#if $board}
    <header class="flex flex-col border-b border-line bg-surface">
      {#if $board.image()}
        <img src={$board.image()} alt="" class="h-40 w-full object-cover" />
      {/if}
      <div class="flex flex-col gap-3 p-4">
        {#if $board.description()}
          <p class="wrap-break-word">{$board.description()}</p>
        {/if}
        {#if topics.length > 0}
          <div class="flex flex-wrap gap-1">
            {#each topics as topic (topic)}
              <span class="badge badge-sm rounded-full font-normal">#{topic}</span>
            {/each}
          </div>
        {/if}
        <div class="flex flex-wrap items-center gap-3 text-sm text-content-muted">
          <Button class="flex items-center gap-3" onclick={showContributors}>
            <ProfileCircles pubkeys={contributors} size={5} />
            <span class="underline underline-offset-2">
              {contributors.length}
              {contributors.length === 1 ? "contributor" : "contributors"}
            </span>
          </Button>
          <span>{shelved.length} {shelved.length === 1 ? "link" : "links"}</span>
        </div>
      </div>
    </header>
    <div class="flex items-center gap-2 border-b border-line bg-surface px-4 py-3">
      <label class="input input-group flex w-auto min-w-0 grow items-center gap-2">
        <Icon size={4} icon={Magnifier} />
        <input
          bind:value={search}
          class="min-w-0 grow"
          type="text"
          placeholder="Search this shelf..." />
      </label>
      <Button
        class="button button-input shrink-0 {layout === 'list'
          ? 'button-primary'
          : 'button-neutral'}"
        aria-pressed={layout === "list"}
        onclick={toggleList}>
        <Icon size={4} icon={List} />
        List
      </Button>
    </div>
    {#if visible.length === 0}
      <div class="flex flex-col items-center gap-4 py-16 text-center">
        {#if term}
          <p class="opacity-70">Nothing on this shelf matches that.</p>
        {:else}
          <p class="opacity-70">This shelf doesn't have any links yet.</p>
          <Button class="button button-primary" onclick={addLinks}>
            <Icon icon={AddCircle} />
            Add the first link
          </Button>
        {/if}
      </div>
    {:else if layout === "cards"}
      <div class="bg-surface">
        {#each visible as pin (pin.event.id)}
          <PinItem {url} {pin} {context} card={false} />
        {/each}
      </div>
    {:else}
      <PinList {url} {address} pins={visible} {context} />
    {/if}
    <div class="border-t border-line bg-surface pt-1">
      <EventComments noun="shelf" event={$board.event} {url} {context} />
    </div>
  {:else}
    <LoadingFallback loadingMessage="Loading shelf..." failureMessage="Failed to load shelf." />
  {/if}
</PageContent>
