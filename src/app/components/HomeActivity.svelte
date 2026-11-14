<script lang="ts">
  import {onDestroy} from "svelte"
  import {sortBy} from "@welshman/lib"
  import type {TrustedEvent} from "@welshman/util"
  import Spinner from "@lib/components/Spinner.svelte"
  import HomeActivityFilters from "@app/components/HomeActivityFilters.svelte"
  import HomeActivityItem from "@app/components/HomeActivityItem.svelte"
  import HomeActivityItemSpace from "@app/components/HomeActivityItemSpace.svelte"
  import HomeNotificationItem from "@app/components/HomeNotificationItem.svelte"
  import {isSpaceActivity, recentConversations, unreadSpaceContent} from "@app/features/activity"
  import type {Activity, SpaceContent} from "@app/features/activity"
  import {makeEngagement} from "@app/features/engagement"
  import {
    countNotificationFacets,
    includedNotificationFacets,
    notificationEntries,
    notificationEvents,
    notificationsLoaded,
    notificationsUnread,
    readNotifications,
  } from "@app/features/notifications"
  import type {NotificationFacet, NotificationGroup} from "@app/features/notifications"

  type Entry = {key: string; timestamp: number} & (
    | {type: "conversation"; activity: Activity}
    | {type: "space"; content: SpaceContent}
    | {type: "notification"; group: NotificationGroup; note: TrustedEvent}
  )

  const engagement = makeEngagement({withReplies: true})

  const includeSpaces = $derived($includedNotificationFacets.includes("spaces"))

  // Enough chat to see what is going on, not enough to push every reply off the page.
  const conversations = $derived(
    $recentConversations
      .filter(activity => includeSpaces || !isSpaceActivity(activity))
      .slice(0, 12),
  )

  const spaceContent = $derived(includeSpaces ? $unreadSpaceContent : [])

  const counts = $derived(
    new Map<NotificationFacet, number>([
      ...countNotificationFacets($notificationEvents),
      ["spaces", $recentConversations.filter(isSpaceActivity).length + $unreadSpaceContent.length],
    ]),
  )

  const entries = $derived(
    sortBy(
      entry => -entry.timestamp,
      [
        ...conversations.map(
          (activity): Entry => ({
            type: "conversation",
            key: activity.path,
            timestamp: activity.event.created_at,
            activity,
          }),
        ),
        ...spaceContent.map(
          (content): Entry => ({
            type: "space",
            key: content.url,
            timestamp: content.timestamp,
            content,
          }),
        ),
        ...$notificationEntries.map(
          ({group, note}): Entry => ({
            type: "notification",
            key: group.key,
            timestamp: group.timestamp,
            group,
            note,
          }),
        ),
      ],
    ),
  )

  // Something is waiting and the filters are what is keeping it off the screen.
  const hidden = $derived(
    entries.length === 0 &&
      $notificationEvents.length + $recentConversations.length + $unreadSpaceContent.length > 0,
  )

  // Anything that lands while the stream is showing has been read by the time it is drawn.
  $effect(() => {
    if ($notificationsUnread) {
      readNotifications()
    }
  })

  onDestroy(engagement.stop)
</script>

<div class="flex flex-col divide-y divide-line border-t border-line bg-surface-less">
  <div class="px-4 py-3">
    <HomeActivityFilters {counts} />
  </div>
  {#each entries as entry (entry.key)}
    {#if entry.type === "conversation"}
      <HomeActivityItem activity={entry.activity} />
    {:else if entry.type === "space"}
      <HomeActivityItemSpace content={entry.content} />
    {:else}
      <div class="p-4">
        <HomeNotificationItem group={entry.group} note={entry.note} {engagement} />
      </div>
    {/if}
  {/each}
  {#if hidden}
    <div class="px-4 py-12 text-center font-medium">Nothing matches those filters</div>
  {:else if entries.length === 0 && !$notificationsLoaded}
    <div class="flex justify-center px-4 py-12">
      <Spinner loading />
    </div>
  {:else if entries.length === 0}
    <div class="flex flex-col items-center gap-3 px-4 py-12 text-center">
      <p class="font-medium">You're all caught up</p>
      <p class="max-w-md text-sm opacity-75">
        Your rooms, chats and direct messages collect here, with replies and reactions to your
        notes.
      </p>
    </div>
  {/if}
</div>
