<script lang="ts">
  import {onMount} from "svelte"
  import {ROOMS} from "@welshman/util"
  import {Sync} from "@welshman/app"
  import {createScroller, isMobile} from "@lib/html"
  import {fly} from "@lib/transition"
  import Compass from "@assets/icons/compass.svg?dataurl"
  import AddCircle from "@assets/icons/add-circle.svg?dataurl"
  import Magnifier from "@assets/icons/magnifier.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import Page from "@lib/components/Page.svelte"
  import PageBar from "@lib/components/PageBar.svelte"
  import PageContent from "@lib/components/PageContent.svelte"
  import Divider from "@lib/components/Divider.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import ContentSearch from "@lib/components/ContentSearch.svelte"
  import SpaceAdd from "@app/components/SpaceAdd.svelte"
  import SpaceResult from "@app/components/SpaceResult.svelte"
  import {app} from "@app/core/app"
  import {user} from "@app/core/user"
  import {relays, roomLists} from "@app/core/plugins"
  import {deriveSpaceSearch} from "@app/features/spaces/rooms"
  import {userSpaceUrls} from "@app/features/spaces"
  import {PLATFORM_RELAYS, DEFAULT_RELAYS, INDEXER_RELAYS} from "@app/core/env"
  import {bootstrapPubkeys} from "@app/features/people"
  import {parseInviteLink} from "@app/features/spaces/invites"
  import {pushModal} from "@app/navigation/dialogs"

  const addSpace = () => pushModal(SpaceAdd)

  const userSpacesLoaded = $roomLists.load($user.pubkey)
  const spaceSearch = deriveSpaceSearch()

  let term = $state("")
  let limit = $state(20)
  let loading = $state(true)
  let element: Element

  const inviteData = $derived(parseInviteLink(term))
  const searchResults = $derived($spaceSearch.searchOptions(term))
  const userSpaceSet = $derived(new Set($userSpaceUrls))
  const otherSpaces = $derived(
    searchResults.filter(r => !userSpaceSet.has(r.url) && r.url !== inviteData?.url),
  )

  // A space shows as soon as someone lists it, so read a relay document for each row rather than waiting for it.
  $effect(() => {
    for (const {url} of otherSpaces.slice(0, limit)) {
      $relays.load(url)
    }
  })

  onMount(() => {
    const scroller = createScroller({
      element,
      onScroll: () => {
        limit += 20
      },
    })

    const sync = $app.use(Sync)

    // Every room list the indexers hold, so browse is not limited to the people the user follows.
    Promise.allSettled([
      sync.pull({filters: [{kinds: [ROOMS]}], relays: INDEXER_RELAYS}),
      sync.pull({filters: [{kinds: [ROOMS], authors: $bootstrapPubkeys}], relays: DEFAULT_RELAYS}),
    ]).then(() => {
      loading = false
    })

    return () => {
      scroller.stop()
    }
  })
</script>

<Page>
  <PageBar>
    <div class="flex items-center justify-between gap-4" in:fly>
      <div class="truncate min-w-0 flex items-center gap-2 whitespace-nowrap">
        <Icon icon={Compass} size={6} />
        <strong>Spaces</strong>
      </div>
      <div class="flex items-center gap-2">
        {#if PLATFORM_RELAYS.length === 0}
          <Button class="button button-primary button-sm" onclick={addSpace}>
            <Icon icon={AddCircle} />
            Add Space
          </Button>
        {/if}
      </div>
    </div>
  </PageBar>
  <PageContent class="flex flex-col gap-2 p-2 sm:flex flex-col gap-4 sm:p-4">
    <ContentSearch>
      {#snippet input()}
        <label class="flex gap-2 input w-full">
          <Icon icon={Magnifier} />
          <!-- svelte-ignore a11y_autofocus -->
          <input
            autofocus={!isMobile}
            bind:value={term}
            class="min-w-0 grow"
            type="text"
            placeholder="Search for spaces..." />
        </label>
      {/snippet}
      {#snippet content()}
        <div class="flex flex-col gap-2" bind:this={element}>
          {#each PLATFORM_RELAYS as url (url)}
            <SpaceResult {url} />
          {:else}
            {#await userSpacesLoaded}
              <div class="flex items-center justify-center py-20">
                <Spinner size="sm" class="mr-3" />
                Loading spaces...
              </div>
            {:then}
              {#if inviteData}
                <Divider>Search results</Divider>
                {#key inviteData.url}
                  <SpaceResult url={inviteData.url} invite={inviteData.claim ? term : undefined} />
                {/key}
              {/if}
              {#if otherSpaces.length > 0}
                <Divider>Browse Spaces</Divider>
              {/if}
              {#each otherSpaces.slice(0, limit) as relay (relay.url)}
                <SpaceResult url={relay.url} />
              {/each}
              <div class="flex justify-center py-20">
                {#if loading}
                  <Spinner>Looking for spaces...</Spinner>
                {:else if otherSpaces.length === 0}
                  <Spinner loading={false}>No spaces found.</Spinner>
                {/if}
              </div>
            {/await}
          {/each}
        </div>
      {/snippet}
    </ContentSearch>
  </PageContent>
</Page>
