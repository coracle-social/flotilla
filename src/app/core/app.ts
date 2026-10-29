import {derived, writable} from "svelte/store"
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
import type {AppOptions, AppPolicy} from "@welshman/app"
import {DEFAULT_RELAYS, DEFAULT_SEARCH_RELAYS, DUFFLEPUD_URL, INDEXER_RELAYS} from "@app/core/env"

// Flotilla's own policies depend on this module, so the first app is built after they push themselves in.
export const appPolicies: AppPolicy[] = [
  appPolicyWraps,
  appPolicyRelayStats,
  appPolicyCacheDecrypt,
  appPolicyLogSignerMethods,
]

// Where an identity's events live, which the app is built over rather than making its own
type AppStores = Pick<AppOptions, "repository" | "wrapManager">

const makeApp = (user?: User, stores: AppStores = {}) => {
  const instance: App = new App({
    user,
    ...stores,
    config: {
      dufflepudUrl: DUFFLEPUD_URL,
      getDefaultRelays: always(DEFAULT_RELAYS),
      getIndexerRelays: always(INDEXER_RELAYS),
      // Search falls back to the defaults so it works before the user has a search relay list.
      getSearchRelays: () => {
        const list = instance.user && instance.use(SearchRelayLists).get(instance.user.pubkey)
        const urls = list?.urls() ?? []

        return urls.length > 0 ? urls : DEFAULT_SEARCH_RELAYS
      },
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
export const replaceApp = (user: User, stores: AppStores) => {
  appStore.get()?.cleanup()
  setApp(makeApp(user, stores))
}

// Anything bound at module load reads through this, or it keeps reading a discarded app.
export const fromApp = <T>(read: ($app: App) => Readable<T>): Readable<T> =>
  derived(app, ($app, set: (value: T) => void) => read($app).subscribe(set))
