<script lang="ts">
  import {onDestroy, onMount} from "svelte"
  import {POLL} from "@welshman/util"
  import {fly} from "@lib/transition"
  import PollIcon from "@assets/icons/revote.svg?dataurl"
  import Add from "@assets/icons/add.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import PageContent from "@lib/components/PageContent.svelte"
  import {followScroll} from "@lib/pager"
  import FeedFooter from "@app/components/FeedFooter.svelte"
  import SpaceBar from "@app/components/SpaceBar.svelte"
  import PollItem from "@app/components/PollItem.svelte"
  import PollCreate from "@app/components/PollCreate.svelte"
  import * as pages from "@app/navigation/pages"
  import {partitionByActivity} from "@app/tools/content"
  import {makeSpaceFeed} from "@app/tools/feeds/relay"
  import {pushModal} from "@app/navigation/dialogs"
  import {withLogin} from "@app/components/flows/login"
  import type {PageProps} from "./$types"

  const {params}: PageProps = $props()

  const {url} = pages.polls.decode(params)
  const feed = makeSpaceFeed(url, POLL)
  const {events} = feed
  const status = feed.older.status

  const createPoll = () => withLogin(() => pushModal(PollCreate, {url}))

  const {items} = $derived(partitionByActivity(POLL, $events))

  let element: HTMLElement | undefined = $state()

  onMount(() => followScroll(element!, feed.older))

  onDestroy(feed.stop)
</script>

<SpaceBar>
  {#snippet leading()}
    <Icon icon={PollIcon} />
  {/snippet}
  {#snippet title()}
    <strong>Polls</strong>
  {/snippet}
  {#snippet action()}
    <Button class="button button-primary button-sm" onclick={createPoll}>
      <Icon icon={Add} />
      Create
    </Button>
  {/snippet}
</SpaceBar>

<PageContent bind:element class="flex flex-col gap-2 p-2 sm:gap-4 sm:p-4">
  {#each items as event (event.id)}
    <div in:fly>
      <PollItem {url} event={$state.snapshot(event)} />
    </div>
  {/each}
  <FeedFooter
    status={$status}
    isEmpty={items.length === 0}
    loadingMessage="Looking for polls..."
    emptyMessage="No polls found."
    doneMessage="That's all!" />
</PageContent>
