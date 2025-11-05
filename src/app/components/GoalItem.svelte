<script lang="ts">
  import type {TrustedEvent} from "@welshman/util"
  import {getTagValue} from "@welshman/util"
  import Link from "@lib/components/Link.svelte"
  import Content from "@app/components/Content.svelte"
  import ProfileLink from "@app/components/ProfileLink.svelte"
  import GoalActions from "@app/components/GoalActions.svelte"
  import GoalSummary from "@app/components/GoalSummary.svelte"
  import RoomLink from "@app/components/RoomLink.svelte"
  import {makeGoalPath} from "@app/util/routes"

  type Props = {
    url: string
    event: TrustedEvent
  }

  const {url, event}: Props = $props()

  const summary = getTagValue("summary", event.tags)
  const h = getTagValue("h", event.tags)
</script>

<Link class="col-2 card2 bg-alt w-full cursor-pointer shadow-xl" href={makeGoalPath(url, event.id)}>
  <p class="text-2xl">{event.content}</p>
  <Content
    event={{content: summary, tags: event.tags}}
    {url}
    expandMode="inline"
    minLength={50}
    maxLength={300} />
  <GoalSummary {url} {event} />
  <div class="flex w-full flex-col items-end justify-between gap-2 sm:flex-row">
    <span class="whitespace-nowrap py-1 text-sm opacity-75">
      Posted by <ProfileLink pubkey={event.pubkey} {url} />
      {#if h}
        in <RoomLink {url} {h} />
      {/if}
    </span>
    <GoalActions showActivity {url} {event} />
  </div>
</Link>
