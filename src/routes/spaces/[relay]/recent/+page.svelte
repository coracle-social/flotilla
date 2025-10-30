<script lang="ts">
  import {onMount} from "svelte"
  import {derived} from "svelte/store"
  import {page} from "$app/stores"
  import {groupBy, ago, MONTH, first, last, uniq, avg, overlappingPairs} from "@welshman/lib"
  import type {TrustedEvent} from "@welshman/util"
  import {MESSAGE, getTagValue} from "@welshman/util"
  import History from "@assets/icons/history.svg?dataurl"
  import {createScroller} from "@lib/html"
  import Icon from "@lib/components/Icon.svelte"
  import PageBar from "@lib/components/PageBar.svelte"
  import PageContent from "@lib/components/PageContent.svelte"
  import MenuSpaceButton from "@app/components/MenuSpaceButton.svelte"
  import ConversationCard from "@app/components/ConversationCard.svelte"
  import {decodeRelay, deriveEventsForUrl} from "@app/core/state"

  const url = decodeRelay($page.params.relay!)
  const since = ago(MONTH)
  const messages = deriveEventsForUrl(url, [{kinds: [MESSAGE], since}])

  const conversations = derived(messages, $messages => {
    const convs = []

    for (const [h, messages] of groupBy(e => getTagValue("h", e.tags), $messages).entries()) {
      const avgTime = avg(overlappingPairs(messages).map(([a, b]) => a.created_at - b.created_at))
      const groups: TrustedEvent[][] = []
      const group: TrustedEvent[] = []

      // Group conversations by time between messages
      let prevCreatedAt = messages[0].created_at
      for (const message of messages) {
        if (prevCreatedAt - message.created_at < avgTime) {
          group.push(message)
        } else {
          groups.push(group.splice(0))
        }

        prevCreatedAt = message.created_at
      }

      if (group.length > 0) {
        groups.push(group.splice(0))
      }

      // Convert each group into a conversation
      for (const events of groups) {
        if (events.length < 2) {
          continue
        }

        const latest = first(events)!
        const earliest = last(events)!
        const participants = uniq(events.map(msg => msg.pubkey))

        convs.push({h, events, latest, earliest, participants})
      }
    }

    return convs
  })

  let limit = $state(3)
  let element: Element | undefined = $state()

  onMount(() => {
    const scroller = createScroller({
      element: element!,
      onScroll: () => {
        limit += 3
      },
    })

    return () => scroller.stop()
  })
</script>

<PageBar>
  {#snippet icon()}
    <div class="center">
      <Icon icon={History} />
    </div>
  {/snippet}
  {#snippet title()}
    <strong>Recent Activity</strong>
  {/snippet}
  {#snippet action()}
    <div class="row-2">
      <MenuSpaceButton {url} />
    </div>
  {/snippet}
</PageBar>

<div bind:this={element}>
  <PageContent class="flex flex-col gap-2 p-2 pt-4">
    {#if $conversations.length === 0}
      {#if $messages.length > 0}
        {@const events = $messages.slice(0, 1)}
        {@const event = events[0]}
        {@const h = getTagValue("h", event.tags)}
        <ConversationCard
          {h}
          {url}
          {events}
          latest={event}
          earliest={event}
          participants={[event.pubkey]} />
      {:else}
        <div class="py-8 text-center opacity-70">
          <p>No recent conversations</p>
        </div>
      {/if}
    {:else}
      {#each $conversations.slice(0, limit) as { h, events, latest, earliest, participants } (latest.id)}
        <ConversationCard {h} {url} {events} {latest} {earliest} {participants} />
      {/each}
    {/if}
  </PageContent>
</div>
