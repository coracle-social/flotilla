<script lang="ts">
  import {derived} from "svelte/store"
  import {groupBy, ago, MONTH, first, last, uniq, avg, overlappingPairs} from "@welshman/lib"
  import {MESSAGE, getTagValue} from "@welshman/util"
  import type {TrustedEvent} from "@welshman/util"
  import ChatRound from "@assets/icons/chat-round.svg?dataurl"
  import AltArrowDown from "@assets/icons/alt-arrow-down.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import ConversationCard from "@app/components/ConversationCard.svelte"
  import {deriveEventsForUrl} from "@app/core/state"

  type Props = {
    url: string
  }

  const {url}: Props = $props()
  const since = ago(MONTH)
  const messages = deriveEventsForUrl(url, [{kinds: [MESSAGE], since}])

  const conversations = derived(messages, $messages => {
    const convs = []

    for (const [room, messages] of groupBy(e => getTagValue("h", e.tags), $messages).entries()) {
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

        convs.push({room, events, latest, earliest, participants})
      }
    }

    return convs
  })

  const viewMore = () => {
    limit += 3
  }

  let limit = $state(3)
</script>

<div class="card2 bg-alt">
  <div class="flex flex-col gap-4">
    <h3 class="flex items-center gap-2 text-lg font-semibold">
      <Icon icon={ChatRound} />
      Recent Conversations
    </h3>
    <div class="flex flex-col gap-4">
      {#if $conversations.length === 0}
        {#if $messages.length > 0}
          {@const events = $messages.slice(0, 1)}
          {@const event = events[0]}
          {@const room = getTagValue("h", event.tags)}
          <ConversationCard
            {url}
            {room}
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
        {#each $conversations.slice(0, limit) as { room, events, latest, earliest, participants } (latest.id)}
          <ConversationCard {url} {room} {events} {latest} {earliest} {participants} />
        {/each}
        {#if $conversations.length > limit}
          <Button class="btn btn-primary" onclick={viewMore}>
            View more conversations
            <Icon icon={AltArrowDown} />
          </Button>
        {/if}
      {/if}
    </div>
  </div>
</div>
