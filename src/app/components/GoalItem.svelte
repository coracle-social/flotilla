<script lang="ts">
  import type {Readable} from "svelte/store"
  import type {TrustedEvent} from "@welshman/util"
  import {ZapGoal} from "@welshman/domain"
  import Link from "@lib/components/Link.svelte"
  import Cv from "@lib/components/Cv.svelte"
  import {reader} from "@app/core"
  import Content from "@app/components/Content.svelte"
  import ProfileLink from "@app/components/ProfileLink.svelte"
  import GoalActions from "@app/components/GoalActions.svelte"
  import type {FeedContext} from "@app/feeds"
  import type {GoalProgress} from "@app/goals"
  import GoalSummary from "@app/components/GoalSummary.svelte"
  import RoomLink from "@app/components/RoomLink.svelte"
  import UnreadDot from "@app/components/UnreadDot.svelte"
  import {makeGoalPath} from "@app/routes"

  type Props = {
    url: string
    event: TrustedEvent
    context: FeedContext
    progress?: Readable<GoalProgress>
  }

  const {url, event, context, progress}: Props = $props()

  const goal = reader(ZapGoal)(event)

  const path = makeGoalPath(url, event.id)
  const title = goal.title()
  const summary = goal.summary()
  const image = goal.image()
  const h = goal.room()
</script>

<Cv tag={Link} class="relative flex flex-col gap-3 card card-interactive w-full" href={path}>
  <UnreadDot {path} class="absolute right-3 top-3" />
  {#if image}
    <img src={image} alt="" class="h-40 w-full max-w-full rounded-2xl object-cover" />
  {/if}
  <p class="line-clamp-2 wrap-break-word text-xl font-bold">{title}</p>
  {#if summary}
    <div class="text-sm text-content-muted">
      <Content
        event={{content: summary, tags: event.tags}}
        {url}
        expandMode="inline"
        minLength={50}
        maxLength={180} />
    </div>
  {/if}
  <GoalSummary {url} {event} {progress} />
  <div class="flex w-full min-w-0 flex-wrap items-center justify-between gap-2">
    <span class="min-w-0 py-1 text-sm text-content-muted">
      by <ProfileLink pubkey={event.pubkey} {url} />
      {#if h}
        in <RoomLink {url} {h} />
      {/if}
    </span>
    <GoalActions showActivity {url} {event} {context} />
  </div>
</Cv>
