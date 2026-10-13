import {derived, readable, writable} from "svelte/store"
import type {Readable} from "svelte/store"
import {always} from "@welshman/lib"
import type {Maybe} from "@welshman/lib"
import {withGetter} from "@welshman/store"
import type {ReadableWithGetter} from "@welshman/store"
import {
  App,
  SearchRelayLists,
  User,
  appPolicyCacheDecrypt,
  appPolicyLogSignerMethods,
  appPolicyRelayStats,
  appPolicyWraps,
} from "@welshman/app"
import type {AppPolicy, DerivedPlugin, Plugin} from "@welshman/app"
import {DEFAULT_RELAYS, DEFAULT_SEARCH_RELAYS, DUFFLEPUD_URL, INDEXER_RELAYS} from "@app/core/env"

// Flotilla's own policies depend on this module, so the first app is built after they push themselves in.
export const appPolicies: AppPolicy[] = [
  appPolicyWraps,
  appPolicyRelayStats,
  appPolicyCacheDecrypt,
  appPolicyLogSignerMethods,
]

const makeApp = (user?: User) => {
  const instance: App = new App({
    user,
    config: {
      dufflepudUrl: DUFFLEPUD_URL,
      getDefaultRelays: always(DEFAULT_RELAYS),
      getIndexerRelays: always(INDEXER_RELAYS),
      getSearchRelays: () => userSearchRelayUrls.get(),
    },
    policies: appPolicies,
  })

  return instance
}

const appStore = withGetter(writable<Maybe<App>>(undefined))

const getApp = () => appStore.get() ?? setApp(makeApp())

const setApp = (instance: App) => {
  appStore.set(instance)

  return instance
}

// An app is scoped to a single identity, so logging in replaces it wholesale.
export const app: ReadableWithGetter<App> = {
  get: getApp,
  subscribe: run => {
    getApp()

    return appStore.subscribe($app => run($app!))
  },
}

// Read the store directly, so restoring a session doesn't build an anonymous app to tear it down.
export const replaceApp = (user: User) => {
  appStore.get()?.cleanup()
  setApp(makeApp(user))
}

// Throws while signed out, so use `$app.user` where absence is a legitimate state.
export const user = withGetter(derived(app, $app => User.require($app)))

// Anything bound at module load reads through this, or it keeps reading a discarded app.
export const fromApp = <T>(read: ($app: App) => Readable<T>): Readable<T> =>
  derived(app, ($app, set: (value: T) => void) => read($app).subscribe(set))

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

// The relays profile search runs against, falling back so search works before the user has any.
export const userSearchRelayUrls = withGetter(
  derived(
    fromApp($app =>
      $app.user ? $app.use(SearchRelayLists).urls($app.user.pubkey).$ : readable<string[]>([]),
    ),
    urls => (urls.length > 0 ? urls : DEFAULT_SEARCH_RELAYS),
  ),
)
