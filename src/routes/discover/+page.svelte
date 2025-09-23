<script lang="ts">
  import {onMount} from "svelte"
  import {debounce} from "throttle-debounce"
  import {dec, tryCatch} from "@welshman/lib"
  import {ROOMS, normalizeRelayUrl, isRelayUrl} from "@welshman/util"
  import {Router} from "@welshman/router"
  import {load} from "@welshman/net"
  import type {Relay} from "@welshman/app"
  import {relays, createSearch, loadRelay, loadRelaySelections} from "@welshman/app"
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
  import {getMembershipUrls, loadMembership, defaultPubkeys, membersByUrl} from "@app/core/state"
  import {pushModal} from "@app/util/modal"

  const openMenu = () => pushModal(SpaceAdd)

  const termUrl = $derived(tryCatch(() => normalizeRelayUrl(term)) || "")

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
      ...$defaultPubkeys.map(async pubkey => {
        await loadRelaySelections(pubkey)

        const membership = await loadMembership(pubkey)
        const urls = getMembershipUrls(membership)

        await Promise.all(urls.map(url => loadRelay(url)))
      }),
    ])

  const relaySearch = $derived(
    createSearch(
      $relays.filter(r => $membersByUrl.has(r.url) && r.url !== termUrl),
      {
        getValue: (relay: Relay) => relay.url,
        sortFn: ({score, item}) => {
          if (score && score > 0.1) return -score!

          const wotScore = $membersByUrl.get(item.url)?.size || 0

          return score ? dec(score) * wotScore : -wotScore
        },
        fuseOptions: {
          keys: ["url", "name", {name: "description", weight: 0.3}],
          shouldSort: false,
        },
      },
    ),
  )

  const openSpace = (url: string) => pushModal(SpaceCheck, {url})

  let term = $state("")
  let limit = $state(20)
  let showScanner = $state(false)
  let element: Element

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
            <input bind:value={term} class="grow" type="text" placeholder="Search for spaces..." />
            <Button onclick={toggleScanner} class="center">
              <Icon icon={QrCode} />
            </Button>
          </label>
          <Button class="btn btn-primary" onclick={openMenu}>
            <Icon icon={AddCircle} />
          </Button>
        </div>
        {#if showScanner}
          <Scanner onscan={onScan} />
        {/if}
      </div>
    {/snippet}
    {#snippet content()}
      <div class="col-2 scroll-container" bind:this={element}>
        {#key termUrl}
          {#if isRelayUrl(termUrl)}
            <Button
              class="card2 bg-alt shadow-xl transition-all hover:shadow-2xl hover:dark:brightness-[1.1]"
              onclick={() => openSpace(termUrl)}>
              <RelaySummary url={termUrl} />
            </Button>
          {/if}
        {/key}
        {#each relaySearch.searchOptions(term).slice(0, limit) as relay (relay.url)}
          <Button
            class="card2 bg-alt shadow-xl transition-all hover:shadow-2xl hover:dark:brightness-[1.1]"
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
