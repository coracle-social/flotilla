<script lang="ts">
  import {onMount} from "svelte"
  import {page} from "$app/stores"
  import {sortBy, max, nthEq} from "@welshman/lib"
  import type {TrustedEvent} from "@welshman/util"
  import {ZAP_GOAL, DELETE, COMMENT, getListTags, getPubkeyTagValues} from "@welshman/util"
  import {userMutes} from "@welshman/app"
  import {fly} from "@lib/transition"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import PageBar from "@lib/components/PageBar.svelte"
  import PageContent from "@lib/components/PageContent.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import MenuSpaceButton from "@app/components/MenuSpaceButton.svelte"
  import GoalItem from "@app/components/GoalItem.svelte"
  import GoalCreate from "@app/components/GoalCreate.svelte"
  import {decodeRelay, getEventsForUrl, REACTION_KINDS} from "@app/state"
  import {setChecked} from "@app/notifications"
  import {makeFeed} from "@app/requests"
  import {pushModal} from "@app/modal"

  const url = decodeRelay($page.params.relay)
  const mutedPubkeys = getPubkeyTagValues(getListTags($userMutes))
  const goals: TrustedEvent[] = $state([])
  const comments: TrustedEvent[] = $state([])

  let loading = $state(true)
  let element: HTMLElement | undefined = $state()

  const createGoal = () => pushModal(GoalCreate, {url})

  const events = $derived.by(() => {
    const scores = new Map<string, number>()

    for (const comment of comments) {
      const id = comment.tags.find(nthEq(0, "E"))?.[1]

      if (id) {
        scores.set(id, max([scores.get(id), comment.created_at]))
      }
    }

    return sortBy(e => -max([scores.get(e.id), e.created_at]), goals)
  })

  onMount(() => {
    const {cleanup} = makeFeed({
      element: element!,
      relays: [url],
      feedFilters: [{kinds: [ZAP_GOAL, COMMENT]}],
      subscriptionFilters: [
        {kinds: [ZAP_GOAL, DELETE, ...REACTION_KINDS]},
        {kinds: [COMMENT], "#K": [String(ZAP_GOAL)]},
      ],
      initialEvents: getEventsForUrl(url, [{kinds: [ZAP_GOAL, COMMENT], limit: 10}]),
      onEvent: event => {
        if (event.kind === ZAP_GOAL && !mutedPubkeys.includes(event.pubkey)) {
          goals.push(event)
        }

        if (event.kind === COMMENT) {
          comments.push(event)
        }
      },
      onExhausted: () => {
        loading = false
      },
    })

    return () => {
      cleanup()
      setChecked($page.url.pathname)
    }
  })
</script>

<PageBar>
  {#snippet icon()}
    <div class="center">
      <Icon icon="notes-minimalistic" />
    </div>
  {/snippet}
  {#snippet title()}
    <strong>Fundraising Goals</strong>
  {/snippet}
  {#snippet action()}
    <div class="row-2">
      <Button class="btn btn-primary btn-sm" onclick={createGoal}>
        <Icon icon="notes-minimalistic" />
        Create a Goal
      </Button>
      <MenuSpaceButton {url} />
    </div>
  {/snippet}
</PageBar>

<PageContent bind:element class="flex flex-col gap-2 p-2 pt-4">
  {#each events as event (event.id)}
    <div in:fly>
      <GoalItem {url} event={$state.snapshot(event)} />
    </div>
  {/each}
  <p class="flex h-10 items-center justify-center py-20">
    <Spinner {loading}>
      {#if loading}
        Looking for goals...
      {:else if events.length === 0}
        No goals found.
      {:else}
        That's all!
      {/if}
    </Spinner>
  </p>
</PageContent>
