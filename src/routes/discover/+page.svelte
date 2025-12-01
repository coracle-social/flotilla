<script lang="ts">
  import {onMount} from "svelte"
  import {debounce} from "throttle-debounce"
  import {dec} from "@welshman/lib"
  import type {RelayProfile} from "@welshman/util"
  import {ROOMS} from "@welshman/util"
  import {Router} from "@welshman/router"
  import {load} from "@welshman/net"
  import {relays, createSearch, loadRelay} from "@welshman/app"
  import {createScroller} from "@lib/html"
  import {fly} from "@lib/transition"
  import QrCode from "@assets/icons/qr-code.svg?dataurl"
  import AddCircle from "@assets/icons/add-circle.svg?dataurl"
  import Magnifier from "@assets/icons/magnifier.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Page from "@lib/components/Page.svelte"
  import Scanner from "@lib/components/Scanner.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import Button from "@lib/components/Button.svelte"
  import PageHeader from "@lib/components/PageHeader.svelte"
  import ContentSearch from "@lib/components/ContentSearch.svelte"
  import SpaceAdd from "@app/components/SpaceAdd.svelte"
  import SpaceInviteAccept from "@app/components/SpaceInviteAccept.svelte"
  import RelaySummary from "@app/components/RelaySummary.svelte"
  import SpaceCheck from "@app/components/SpaceCheck.svelte"
  import {
    bootstrapPubkeys,
    loadGroupList,
    getSpaceUrlsFromGroupList,
    groupListPubkeysByUrl,
    parseInviteLink,
  } from "@app/core/state"
  import {pushModal} from "@app/util/modal"

  const openMenu = () => pushModal(SpaceAdd, {hideDiscover: true})

  const toggleScanner = () => {
    showScanner = !showScanner
  }

  const onScan = debounce(1000, async (data: string) => {
    showScanner = false
    pushModal(SpaceInviteAccept, {invite: data})
  })

  const discoverRelays = () =>
    Promise.all([
      load({
        filters: [{kinds: [ROOMS]}],
        relays: Router.get().Index().getUrls(),
      }),
      ...$bootstrapPubkeys.map(async pubkey => {
        const list = await loadGroupList(pubkey)
        const urls = getSpaceUrlsFromGroupList(list)

        await Promise.all(urls.map(url => loadRelay(url)))
      }),
    ])

  const relaySearch = $derived(
    createSearch(
      $relays.filter(r => $groupListPubkeysByUrl.has(r.url) && r.url !== inviteData?.url),
      {
        getValue: (relay: RelayProfile) => relay.url,
        sortFn: ({score, item}) => {
          if (score && score > 0.1) return -score!

          const wotScore = $groupListPubkeysByUrl.get(item.url)!.size

          return score ? dec(score) * wotScore : -wotScore
        },
        fuseOptions: {
          keys: ["url", "name", {name: "description", weight: 0.3}],
          shouldSort: false,
        },
      },
    ),
  )

  const openSpace = (url: string, claim = "") => {
    if (claim) {
      pushModal(SpaceInviteAccept, {invite: term})
    } else {
      pushModal(SpaceCheck, {url})
    }
  }

  let term = $state("")
  let limit = $state(20)
  let showScanner = $state(false)
  let element: Element

  const inviteData = $derived(parseInviteLink(term))

  onMount(() => {
    const scroller = createScroller({
      element,
      onScroll: () => {
        limit += 20
      },
    })

    return () => {
      scroller.stop()
    }
  })
</script>

<Page class="cw-full">
  <ContentSearch>
    {#snippet input()}
      <div class="flex flex-col gap-2">
        <PageHeader>
          {#snippet title()}
            Discover Spaces
          {/snippet}
          {#snippet info()}
            Find communities all across the nostr network
          {/snippet}
        </PageHeader>
        <div class="row-2 min-w-0 flex-grow items-center">
          <label class="input input-bordered flex flex-grow items-center gap-2">
            <Icon icon={Magnifier} />
            <input
              bind:value={term}
              class="grow"
              type="text"
              placeholder="Search for spaces or paste invite link..." />
            <Button onclick={toggleScanner} class="center">
              <Icon icon={QrCode} />
            </Button>
          </label>
          <Button class="btn btn-primary" onclick={openMenu}>
            <Icon icon={AddCircle} />
            <span class="hidden sm:inline">Add Space</span>
          </Button>
        </div>
        {#if showScanner}
          <Scanner onscan={onScan} />
        {/if}
      </div>
    {/snippet}
    {#snippet content()}
      <div class="col-2 scroll-container" bind:this={element}>
        {#if inviteData}
          {#key inviteData.url}
            <Button
              class="card2 bg-alt shadow-md transition-all hover:shadow-lg hover:dark:brightness-[1.1]"
              onclick={() => openSpace(inviteData.url, inviteData.claim)}>
              <RelaySummary url={inviteData.url} />
            </Button>
          {/key}
        {/if}
        {#each relaySearch.searchOptions(term).slice(0, limit) as relay (relay.url)}
          <Button
            class="card2 bg-alt shadow-md transition-all hover:shadow-lg hover:dark:brightness-[1.1]"
            onclick={() => openSpace(relay.url)}>
            <RelaySummary url={relay.url} />
          </Button>
        {/each}
        {#await discoverRelays()}
          <div class="flex justify-center py-20" out:fly>
            <Spinner loading>Looking for spaces...</Spinner>
          </div>
        {/await}
      </div>
    {/snippet}
  </ContentSearch>
</Page>
