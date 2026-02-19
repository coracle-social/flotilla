<script lang="ts">
  import {onMount} from "svelte"
  import {derived as _derived} from "svelte/store"
  import {dec, sleep} from "@welshman/lib"
  import type {RelayProfile} from "@welshman/util"
  import {throttled} from "@welshman/store"
  import {relays, createSearch} from "@welshman/app"
  import {createScroller} from "@lib/html"
  import AddCircle from "@assets/icons/add-circle.svg?dataurl"
  import Login from "@assets/icons/login-3.svg?dataurl"
  import Magnifier from "@assets/icons/magnifier.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Page from "@lib/components/Page.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import Divider from "@lib/components/Divider.svelte"
  import Button from "@lib/components/Button.svelte"
  import CardButton from "@lib/components/CardButton.svelte"
  import Link from "@lib/components/Link.svelte"
  import PageHeader from "@lib/components/PageHeader.svelte"
  import ContentSearch from "@lib/components/ContentSearch.svelte"
  import SpaceInviteAccept from "@app/components/SpaceInviteAccept.svelte"
  import RelaySummary from "@app/components/RelaySummary.svelte"
  import SpaceJoin from "@app/components/SpaceJoin.svelte"
  import {groupListPubkeysByUrl, parseInviteLink} from "@app/core/state"
  import {pushModal} from "@app/util/modal"

  const startJoin = () => pushModal(SpaceInviteAccept)

  const relaySearch = _derived(throttled(1000, relays), $relays => {
    const options = $relays.filter(r => $groupListPubkeysByUrl.has(r.url))

    return createSearch(options, {
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
    })
  })

  const openSpace = (url: string, claim = "") => {
    if (claim) {
      pushModal(SpaceInviteAccept, {invite: term})
    } else {
      pushModal(SpaceJoin, {url})
    }
  }

  let term = $state("")
  let limit = $state(20)
  let element: Element

  const options = $derived($relaySearch.searchOptions(term).filter(r => r.url !== inviteData?.url))
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
            Join a Space
          {/snippet}
          {#snippet info()}
            Find communities all across the nostr network
          {/snippet}
        </PageHeader>
        <div class="grid gap-3 sm:grid-cols-2">
          <Button onclick={startJoin} class="w-full">
            <CardButton class="btn-primary w-full">
              {#snippet icon()}
                <div><Icon icon={Login} size={7} /></div>
              {/snippet}
              {#snippet title()}
                <div>Join with an invite</div>
              {/snippet}
              {#snippet info()}
                <div>Paste a link and jump right in.</div>
              {/snippet}
            </CardButton>
          </Button>
          <Link href="/spaces/create" class="w-full">
            <CardButton class="btn-neutral w-full">
              {#snippet icon()}
                <div><Icon icon={AddCircle} size={7} /></div>
              {/snippet}
              {#snippet title()}
                <div>Create a new space</div>
              {/snippet}
              {#snippet info()}
                <div>Launch a place for your people.</div>
              {/snippet}
            </CardButton>
          </Link>
        </div>
        <Divider>Or</Divider>
        <div class="min-w-0">
          <label class="input input-bordered flex items-center gap-2">
            <Icon icon={Magnifier} />
            <input bind:value={term} class="grow" type="text" placeholder="Search for spaces..." />
          </label>
        </div>
      </div>
    {/snippet}
    {#snippet content()}
      <div class="col-2" bind:this={element}>
        {#if inviteData}
          {#key inviteData.url}
            <Button
              class="card2 bg-alt shadow-md transition-all hover:shadow-lg hover:dark:brightness-[1.1]"
              onclick={() => openSpace(inviteData.url, inviteData.claim)}>
              <RelaySummary url={inviteData.url} />
            </Button>
          {/key}
        {/if}
        {#each options.slice(0, limit) as relay (relay.url)}
          <Button
            class="card2 bg-alt shadow-md transition-all hover:shadow-lg hover:dark:brightness-[1.1]"
            onclick={() => openSpace(relay.url)}>
            <RelaySummary url={relay.url} />
          </Button>
        {/each}
        <div class="flex justify-center py-20">
          {#await sleep(5000)}
            <Spinner loading>Looking for spaces...</Spinner>
          {:then}
            {#if options.length === 0}
              <Spinner>No spaces found.</Spinner>
            {/if}
          {/await}
        </div>
      </div>
    {/snippet}
  </ContentSearch>
</Page>
