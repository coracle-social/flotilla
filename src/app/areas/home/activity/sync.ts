import {writable} from "svelte/store"
import type {Unsubscriber, Writable} from "svelte/store"
import {int, MINUTE, ms, noop, now} from "@welshman/lib"
import type {Maybe} from "@welshman/lib"
import {userInbox} from "@welshman/util"
import {app} from "@app/core/app"
import {network, router} from "@app/core/plugins"
import {makeKeyedSyncs} from "@app/core/sync"
import {userRelayList} from "@app/core/user"
import {getActivityFilters} from "@app/areas/home/activity/model"

// Whether every inbox relay has answered its first poll, which tells an empty stream from a loading one.
export const activityLoaded: Writable<boolean> = writable(false)

const getInboxUrls = async () => {
  const scenario = await router.get().resolve([userInbox()])

  return scenario.limit(10).getUrls()
}

const pollRelay = (url: string, pubkey: string, onAnswered: () => void): Unsubscriber => {
  const controller = new AbortController()

  let since: Maybe<number>

  const poll = async () => {
    const asked = now()

    await network.get().load({
      relays: [url],
      signal: controller.signal,
      priority: since ? -1 : 0,
      filters: getActivityFilters(pubkey).map(filter =>
        since ? {...filter, since} : {...filter, limit: 100},
      ),
    })

    // A minute early because the relay stamps by its own clock.
    since = asked - int(MINUTE)
  }

  poll().finally(onAnswered)

  const interval = setInterval(poll, ms(int(2, MINUTE)))

  return () => {
    clearInterval(interval)
    controller.abort()
  }
}

export const syncActivity = (): Unsubscriber => {
  activityLoaded.set(false)

  const pubkey = app.get().user?.pubkey

  if (pubkey) {
    let unanswered: Maybe<Set<string>>
    let stopped = false

    const onAnswered = (url: string) => {
      if (unanswered) {
        unanswered.delete(url)

        if (unanswered.size === 0) {
          activityLoaded.set(true)
        }
      }
    }

    const relaySyncs = makeKeyedSyncs(url => pollRelay(url, pubkey, () => onAnswered(url)))

    const reconcile = async () => {
      const urls = await getInboxUrls()

      if (!stopped) {
        if (!unanswered) {
          unanswered = new Set(urls)

          if (urls.length === 0) {
            activityLoaded.set(true)
          }
        }

        relaySyncs.reconcile(urls)
      }
    }

    const unsubscribe = userRelayList.subscribe(reconcile)

    return () => {
      stopped = true
      relaySyncs.stop()
      unsubscribe()
    }
  }

  return noop
}
