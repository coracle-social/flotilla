<script lang="ts">
  import {onMount} from "svelte"
  import {derived as _derived} from "svelte/store"
  import {addToMapKey, dec, sleep} from "@welshman/lib"
  import {ROOMS} from "@welshman/util"
  import type {Relay} from "@welshman/domain"
  import {throttled} from "@welshman/store"
  import {Sync, createSearch} from "@welshman/app"
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
  import RelaySummary from "@app/components/RelaySummary.svelte"
  import SpaceAdd from "@app/components/SpaceAdd.svelte"
  import SpaceInviteAccept from "@app/components/SpaceInviteAccept.svelte"
  import SpaceJoin from "@app/components/SpaceJoin.svelte"
  import {app, relays, roomLists, user} from "@app/core"
  import {userSpaceUrls} from "@app/rooms"
  import {PLATFORM_RELAYS, DEFAULT_RELAYS} from "@app/env"
  import {bootstrapPubkeys} from "@app/social"
  import {parseInviteLink} from "@app/access"
  import {pushModal} from "@app/modal"
  import {goToSpace} from "@app/routes"

  const addSpace = () => pushModal(SpaceAdd)

  const userSpacesLoaded = $roomLists.load($user.pubkey)

  // How many people list each space, used both to limit search to spaces someone
  // has joined and to rank them.
  const spacePubkeysByUrl = _derived($roomLists.all.$, $roomLists => {
    const result = new Map<string, Set<string>>()

    for (const roomList of $roomLists) {
      for (const url of roomList.urls()) {
        addToMapKey(result, url, roomList.author())
      }
    }

    return result
  })

  const relaySearch = _derived(
    [throttled(1000, $relays.all.$), spacePubkeysByUrl],
    ([$relays, $spacePubkeysByUrl]) => {
      const options = $relays.filter(r => $spacePubkeysByUrl.has(r.url))

      return createSearch(options, {
        getValue: (relay: Relay) => relay.url,
        sortFn: ({score, item}) => {
          if (score && score > 0.1) {
            return -score!
          }

          const wotScore = $spacePubkeysByUrl.get(item.url)?.size || 0

          return score ? dec(score) * wotScore : -wotScore
        },
        fuseOptions: {
          keys: ["url", "name", {name: "description", weight: 0.3}],
          shouldSort: false,
        },
      })
    },
  )

  const openSpace = (url: string, claim = "") => {
    if ($userSpaceUrls.includes(url)) {
      goToSpace(url)
    } else if (claim) {
      pushModal(SpaceInviteAccept, {invite: term})
    } else {
      pushModal(SpaceJoin, {url})
    }
  }

  let term = $state("")
  let limit = $state(20)
  let element: Element

  const inviteData = $derived(parseInviteLink(term))
  const searchResults = $derived($relaySearch.searchOptions(term))
  const userSpaceSet = $derived(new Set($userSpaceUrls))
  const otherSpaces = $derived(
    searchResults.filter(r => !userSpaceSet.has(r.url) && r.url !== inviteData?.url),
  )

  onMount(() => {
    const scroller = createScroller({
      element,
      onScroll: () => {
        limit += 20
      },
    })

    $app.use(Sync).pull({
      filters: [{kinds: [ROOMS], authors: $bootstrapPubkeys}],
      relays: DEFAULT_RELAYS,
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
            <Button class="card card-interactive" onclick={() => openSpace(url)}>
              <RelaySummary {url} />
            </Button>
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
                  <Button
                    class="card card-interactive"
                    onclick={() => openSpace(inviteData.url, inviteData.claim)}>
                    <RelaySummary url={inviteData.url} />
                  </Button>
                {/key}
              {/if}
              {#if otherSpaces.length > 0}
                <Divider>Browse Spaces</Divider>
              {/if}
              {#each otherSpaces.slice(0, limit) as relay (relay.url)}
                <Button class="card card-interactive" onclick={() => openSpace(relay.url)}>
                  <RelaySummary url={relay.url} />
                </Button>
              {/each}
              <div class="flex justify-center py-20">
                {#await sleep(5000)}
                  <Spinner loading>Looking for spaces...</Spinner>
                {:then}
                  {#if otherSpaces.length === 0}
                    <Spinner>No spaces found.</Spinner>
                  {/if}
                {/await}
              </div>
            {/await}
          {/each}
        </div>
      {/snippet}
    </ContentSearch>
  </PageContent>
</Page>
