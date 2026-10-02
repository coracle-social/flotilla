<script lang="ts">
  import {onDestroy, onMount} from "svelte"
  import {writable} from "svelte/store"
  import type {Writable} from "svelte/store"
  import type {Maybe} from "@welshman/lib"
  import {ZAP_RECEIPT} from "@welshman/util"
  import type {TrustedEvent} from "@welshman/util"
  import Spinner from "@lib/components/Spinner.svelte"
  import HomeNetworkNotificationItem from "@app/components/HomeNetworkNotificationItem.svelte"
  import {user} from "@app/core"
  import {isFeedLoading, makeFeed, makeFeedContext, makeScrollLoader} from "@app/feeds"
  import {
    getHomeNotificationRelays,
    homeNotificationFilters,
    homeNotificationsUnread,
    readHomeNotifications,
  } from "@app/notifications"
  import {groupNotifications, isEventMuted} from "@app/social"

  const relays = getHomeNotificationRelays()

  const context = makeFeedContext({relays, withReplies: true})

  let element: HTMLElement | undefined = $state()
  let older: Maybe<ReturnType<typeof makeScrollLoader>> = $state()
  let events: Writable<TrustedEvent[]> = $state(writable([]))
  let stop: Maybe<() => void>

  // A zap receipt is signed by an lnurl server rather than by the zapper, so neither test reads it.
  const isFromSomeoneElse = (event: TrustedEvent) =>
    event.kind === ZAP_RECEIPT || (event.pubkey !== $user.pubkey && !$isEventMuted(event))

  const items = $derived(groupNotifications($events.filter(isFromSomeoneElse)))

  const loading = $derived(isFeedLoading($older))
  const exhausted = $derived($older?.status === "exhausted")

  // Anything that lands while the tab is showing has been read by the time it is drawn.
  $effect(() => {
    if ($homeNotificationsUnread) {
      readHomeNotifications()
    }
  })

  onMount(async () => {
    const feed = makeFeed({
      relays: await relays,
      filters: homeNotificationFilters($user.pubkey),
      onEvent: context.add,
    })

    events = feed.events
    older = makeScrollLoader(element!, feed.loadOlder)
    stop = () => {
      older?.stop()
      feed.cleanup()
    }
  })

  onDestroy(() => {
    stop?.()
    context.cleanup()
  })
</script>

<div class="flex flex-col gap-3 border-t border-line bg-surface-less p-4" bind:this={element}>
  {#if items.length > 0}
    {#each items as notification (notification.key)}
      <HomeNetworkNotificationItem {notification} {context} />
    {/each}
    {#if loading}
      <div class="flex justify-center py-8">
        <Spinner loading />
      </div>
    {/if}
  {:else if exhausted}
    <div class="flex flex-col items-center gap-3 pb-4 text-center">
      <p class="font-medium">Nothing here yet</p>
      <p class="max-w-md text-sm opacity-75">
        Replies, mentions and reactions from outside your spaces collect here.
      </p>
    </div>
  {:else}
    <div class="flex justify-center py-8">
      <Spinner loading>Looking for notifications...</Spinner>
    </div>
  {/if}
</div>
