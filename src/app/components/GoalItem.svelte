<script lang="ts">
  import type {TrustedEvent} from "@welshman/util"
  import {ZapGoal} from "@welshman/domain"
  import Link from "@lib/components/Link.svelte"
  import {reader} from "@app/core"
  import Content from "@app/components/Content.svelte"
  import ProfileLink from "@app/components/ProfileLink.svelte"
  import GoalActions from "@app/components/GoalActions.svelte"
  import type {FeedContext} from "@app/feeds"
  import GoalSummary from "@app/components/GoalSummary.svelte"
  import RoomLink from "@app/components/RoomLink.svelte"
  import UnreadDot from "@app/components/UnreadDot.svelte"
  import {makeGoalPath} from "@app/routes"

  type Props = {
    url: string
    event: TrustedEvent
    context: FeedContext
  }

  const {url, event, context}: Props = $props()

  const goal = reader(ZapGoal)(event)

  const path = makeGoalPath(url, event.id)
  const title = goal.title()
  const summary = goal.summary()
  const h = goal.room()
</script>

<Link class="cv relative flex flex-col gap-2 card card-interactive w-full" href={path}>
  <UnreadDot {path} class="absolute right-3 top-3" />
  <p class="text-2xl">{title}</p>
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
    <GoalActions showActivity {url} {event} {context} />
  </div>
</Link>
