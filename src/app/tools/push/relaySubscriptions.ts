import {equals, throttle} from "@welshman/lib"
import type {Filter} from "@welshman/util"
import {merged} from "@welshman/store"
import {messagingRelayLists, roomLists} from "@app/core/plugins"
import {userSettingsValues} from "@app/core/settings"
import {requireUser} from "@app/core/user"
import {alertSettings} from "@app/tools/alerts/settings"
import {getMessageAlertFilters, getSpaceAlertFilters} from "@app/tools/alerts/policy"

export type RelaySubscription = {
  relay: string
  key: string
  filters: Filter[]
  ignore: Filter[]
}

const diffRelaySubscriptions = (
  current: Map<string, RelaySubscription>,
  next: Map<string, RelaySubscription>,
): {added: RelaySubscription[]; removed: RelaySubscription[]} => {
  const added: RelaySubscription[] = []
  const removed: RelaySubscription[] = []

  for (const [id, subscription] of next) {
    if (!equals(subscription, current.get(id))) {
      added.push(subscription)
    }
  }

  for (const [id, subscription] of current) {
    if (!next.has(id)) {
      removed.push(subscription)
    }
  }

  return {added, removed}
}

// NIP-9a: asks a relay to post matching events to the push server's callback
export const syncRelaySubscriptions = (
  signal: AbortSignal,
  sync: (changes: {
    subscriptions: RelaySubscription[]
    added: RelaySubscription[]
    removed: RelaySubscription[]
  }) => void,
) => {
  const $pubkey = requireUser().pubkey
  let subscriptions = new Map<string, RelaySubscription>()

  const unsubscribe = merged([
    roomLists.get().urls($pubkey).$,
    messagingRelayLists.get().urls($pubkey).$,
    alertSettings,
    userSettingsValues,
  ]).subscribe(
    throttle(3000, ([$spaceUrls, $messagingUrls, $types, $settings]) => {
      const next = new Map<string, RelaySubscription>()
      const messageFilters = getMessageAlertFilters($types, $pubkey)

      const addSubscription = (relay: string, key: string, filters: Filter[], ignore: Filter[]) => {
        if (filters.length > 0) {
          next.set(`${relay}:${key}`, {relay, key, filters, ignore})
        }
      }

      for (const url of $spaceUrls) {
        const {include, ignore} = getSpaceAlertFilters({
          url,
          types: $types,
          settings: $settings,
          pubkey: $pubkey,
        })

        addSubscription(url, "spaces", include, ignore)
      }

      for (const url of $messagingUrls) {
        addSubscription(url, "messages", messageFilters, [])
      }

      const {added, removed} = diffRelaySubscriptions(subscriptions, next)

      subscriptions = next

      if (added.length > 0 || removed.length > 0) {
        sync({subscriptions: Array.from(next.values()), added, removed})
      }
    }),
  )

  signal.addEventListener("abort", unsubscribe)
}
