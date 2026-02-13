<script lang="ts">
  import {onMount} from "svelte"
  import {derived, writable} from "svelte/store"
  import {batch, call, sortBy, uniqBy} from "@welshman/lib"
  import {
    NOTE,
    MESSAGE,
    THREAD,
    CLASSIFIED,
    ZAP_GOAL,
    EVENT_TIME,
    COMMENT,
    getTagValue,
    getTagValues,
    getIdAndAddress,
  } from "@welshman/util"
  import type {TrustedEvent} from "@welshman/util"
  import {
    makeKindFeed,
    makeRelayFeed,
    makeScopeFeed,
    makeIntersectionFeed,
    makeUnionFeed,
    Scope,
  } from "@welshman/feeds"
  import {repository, tracker, makeFeedController, loadUserFollowList} from "@welshman/app"
  import History from "@assets/icons/history.svg?dataurl"
  import {createScroller} from "@lib/html"
  import Icon from "@lib/components/Icon.svelte"
  import PageBar from "@lib/components/PageBar.svelte"
  import PageContent from "@lib/components/PageContent.svelte"
  import NoteItem from "@app/components/NoteItem.svelte"
  import ThreadItem from "@app/components/ThreadItem.svelte"
  import ClassifiedItem from "@app/components/ClassifiedItem.svelte"
  import GoalItem from "@app/components/GoalItem.svelte"
  import CalendarEventItem from "@app/components/CalendarEventItem.svelte"
  import RecentConversation from "@app/components/RecentConversation.svelte"
  import {makeRoomId, userSpaceUrls, loadUserGroupList, CONTENT_KINDS} from "@app/core/state"

  type Activity = {
    type: "message" | "content"
    event: TrustedEvent
    timestamp: number
    count: number
    url: string
  }

  const controller = new AbortController()
  const events = writable<TrustedEvent[]>([])
  const limit = writable(0)

  const recentActivity = derived([events, limit], ([$events, $limit]) => {
    const activity: Activity[] = []
    const activityByRoom = new Map<string, Activity>()
    const latestActivityByKey = new Map<string, number>()

    for (const event of $events.slice(0, $limit)) {
      if (event.kind === MESSAGE) {
        const h = getTagValue("h", event.tags)

        if (!h) continue

        for (const url of tracker.getRelays(event.id)) {
          const id = makeRoomId(url, h)

          const item = activityByRoom.get(id)

          if (!item) {
            activityByRoom.set(id, {
              type: "message",
              event,
              timestamp: event.created_at,
              count: 1,
              url,
            })
          } else if (item.timestamp < event.created_at) {
            item.count++
            item.event = event
            item.timestamp = event.created_at
          }
        }
      } else if (event.kind === COMMENT) {
        for (const k of getTagValues(["E", "A"], event.tags)) {
          latestActivityByKey.set(k, Math.max(latestActivityByKey.get(k) || 0, event.created_at))
        }
      } else {
        for (const k of getIdAndAddress(event)) {
          latestActivityByKey.set(k, Math.max(latestActivityByKey.get(k) || 0, event.created_at))
        }
      }
    }

    for (const item of activityByRoom.values()) {
      activity.push(item)
    }

    for (const [address, timestamp] of latestActivityByKey.entries()) {
      const event = repository.getEvent(address)

      if (event) {
        for (const url of tracker.getRelays(event.id)) {
          activity.push({type: "content", event, timestamp, url, count: 1})
          break
        }
      }
    }

    return sortBy(
      a => -a.timestamp,
      uniqBy(a => a.event.id, activity),
    )
  })

  let loading = $state(true)
  let element: Element | undefined = $state()

  onMount(() => {
    const promise = call(async () => {
      await Promise.all([loadUserGroupList(), loadUserFollowList()])

      const ctrl = makeFeedController({
        useWindowing: true,
        signal: controller.signal,
        feed: makeUnionFeed(
          makeIntersectionFeed(
            makeRelayFeed(...$userSpaceUrls),
            makeKindFeed(COMMENT, ...CONTENT_KINDS),
          ),
          makeIntersectionFeed(makeScopeFeed(Scope.Follows), makeKindFeed(NOTE)),
        ),
        onEvent: batch(100, (evts: TrustedEvent[]) => {
          events.update($events => [...$events, ...evts])
        }),
        onExhausted: () => {
          loading = false
        },
      })

      const scroller = createScroller({
        element: element!,
        delay: 800,
        threshold: 3000,
        onScroll: async () => {
          console.log("scroll")
          limit.update($limit => {
            if ($events.length - $limit < 50) {
              ctrl.load(50)
            }

            return $limit + 10
          })
        },
      })

      return () => {
        scroller.stop()
        controller.abort()
      }
    })

    return () => promise.then(call)
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
    <div class="row-2"></div>
  {/snippet}
</PageBar>

<PageContent class="flex flex-col gap-2 p-2 pt-4" bind:element>
  {#each $recentActivity as { type, event, url, count } (event.id)}
    {#if type === "message"}
      <RecentConversation {url} {event} {count} />
    {:else if event.kind === THREAD}
      <ThreadItem {url} {event} />
    {:else if event.kind === CLASSIFIED}
      <ClassifiedItem {url} {event} />
    {:else if event.kind === ZAP_GOAL}
      <GoalItem {url} {event} />
    {:else if event.kind === EVENT_TIME}
      <CalendarEventItem {url} {event} />
    {:else}
      <NoteItem {url} {event} />
    {/if}
  {:else}
    {#if loading}
      <div class="flex justify-center items-center py-20">
        <span class="loading loading-spinner mr-3"></span>
        Loading recent activity...
      </div>
    {:else}
      <p class="flex flex-col items-center py-20 text-center">No recent activity found!</p>
    {/if}
  {/each}
</PageContent>
