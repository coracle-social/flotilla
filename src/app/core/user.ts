import {derived} from "svelte/store"
import {noop} from "@welshman/lib"
import type {Maybe} from "@welshman/lib"
import {withGetter} from "@welshman/store"
import {FOLLOWS, MUTES, outbox} from "@welshman/util"
import type {FollowListReader} from "@welshman/domain"
import {FollowLists, MuteLists, Profiles, RelayLists, SearchRelayLists, User} from "@welshman/app"
import type {DerivedPlugin, Plugin} from "@welshman/app"
import {app} from "@app/core/app"
import {
  blockedRelayLists,
  blossomServerLists,
  followLists,
  muteLists,
  network,
  profiles,
  relayLists,
  relays,
  router,
  searchRelayLists,
} from "@app/core/plugins"
import {DEFAULT_SEARCH_RELAYS} from "@app/core/env"
import {Settings} from "@app/core/settings"
import {registerSync} from "@app/core/sync"

// Throws while signed out, so use `$app.user` where absence is a legitimate state.
export const user = withGetter(derived(app, $app => User.require($app)))

// The signed-in user's entry in a keyed collection, e.g. deriveUserItem(Profiles).
export const deriveUserItem = <T>(Ctor: Plugin<DerivedPlugin<T>>) =>
  derived(app, ($app, set: (item: Maybe<T>) => void) => {
    let previous: Maybe<T>

    return $app.use(Ctor).index.$.subscribe($index => {
      const item = $app.user ? $index.get($app.user.pubkey) : undefined

      if (item !== previous) {
        previous = item
        set(item)
      }
    })
  })

export const userProfile = deriveUserItem(Profiles)

export const userRelayList = deriveUserItem(RelayLists)

export const userFollowList = deriveUserItem(FollowLists)

export const userMuteList = deriveUserItem(MuteLists)

export const userSearchRelayList = deriveUserItem(SearchRelayLists)

// The relays profile search runs against, falling back so search works before the user has any.
export const userSearchRelayUrls = derived(userSearchRelayList, $searchRelayList => {
  const urls = $searchRelayList?.urls() ?? []

  return urls.length > 0 ? urls : DEFAULT_SEARCH_RELAYS
})

// Syncing

// The user's lists are read from their outbox, so each is loaded again once the relay list arrives.
export const syncUserList = (load: (pubkey: string) => unknown) => {
  const $pubkey = app.get().user?.pubkey

  if ($pubkey) {
    return userRelayList.subscribe(() => load($pubkey))
  }

  return noop
}

const syncUserLists = () => {
  const $pubkey = app.get().user?.pubkey

  if ($pubkey) {
    relayLists.get().load($pubkey)
  }

  return syncUserList(pubkey => {
    blossomServerLists.get().load(pubkey)
    blockedRelayLists.get().load(pubkey)
    followLists.get().load(pubkey)
    muteLists.get().load(pubkey)
    profiles.get().load(pubkey)
    searchRelayLists.get().load(pubkey)
    app.get().use(Settings).load(pubkey)
  })
}

const syncFollowNetwork = async ($followList: Maybe<FollowListReader>) => {
  const authors = $followList?.pubkeys() ?? []

  if (authors.length > 0) {
    const scenario = await router.get().resolve(authors.map(pubkey => outbox(pubkey)))

    network.get().load({
      filters: [{kinds: [FOLLOWS, MUTES], authors}],
      relays: scenario.limit(8).getUrls(),
    })
  }
}

// Search and health checks read the search relays' NIP-11 documents synchronously.
const syncSearchRelayInfo = () =>
  userSearchRelayList.subscribe($searchRelayList => {
    for (const url of $searchRelayList?.urls() ?? []) {
      relays.get().load(url)
    }
  })

// Registry

export const registerUser = () => {
  registerSync(syncUserLists)
  registerSync(syncSearchRelayInfo)
  registerSync(() => userFollowList.subscribe(syncFollowNetwork))
}
