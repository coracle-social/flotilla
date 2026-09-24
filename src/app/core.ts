import {derived, readable, writable} from "svelte/store"
import type {Readable} from "svelte/store"
import {always} from "@welshman/lib"
import type {Maybe} from "@welshman/lib"
import {withGetter} from "@welshman/store"
import type {ReadableWithGetter} from "@welshman/store"
import {
  App,
  BlockedRelayLists,
  BlossomServerLists,
  Deletes,
  Domain,
  FollowLists,
  Handles,
  Logger,
  MessagingRelayLists,
  MuteLists,
  Network,
  PinLists,
  Profiles,
  Reactions,
  RelayLists,
  RelayManagement,
  RelayMemberLists,
  RelayRoles,
  RelayStats,
  Relays,
  RoomLists,
  RoomPinLists,
  Rooms,
  Router,
  SearchRelayLists,
  Thunks,
  User,
  Wot,
  Wraps,
  appPolicyCacheDecrypt,
  appPolicyLogSignerMethods,
  appPolicyRelayStats,
  appPolicyWraps,
} from "@welshman/app"
import type {AppPolicy, DerivedPlugin, Plugin, Session} from "@welshman/app"
import type {BaseEventReader, EventQuery, EventWriter, KindFactory} from "@welshman/domain"
import {DEFAULT_RELAYS, DEFAULT_SEARCH_RELAYS, DUFFLEPUD_URL, INDEXER_RELAYS} from "@app/env"

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

export const session = withGetter(writable<Maybe<Session>>(undefined))

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

export const login = async ($session: Session) => {
  const $user = await User.fromSession($session)

  if (!$user) {
    throw new Error(`Unable to log in using ${$session.method}`)
  }

  // Read the store directly, so restoring a session doesn't build an anonymous app to tear it down.
  appStore.get()?.cleanup()
  setApp(makeApp($user))
  session.set($session)
}

// Plugins bound to the current app, so login swapping the app repoints every reader.
export const usePlugin = <T>(Ctor: Plugin<T>) => withGetter(derived(app, $app => $app.use(Ctor)))

export const blockedRelayLists = usePlugin(BlockedRelayLists)
export const blossomServerLists = usePlugin(BlossomServerLists)
export const deletes = usePlugin(Deletes)
export const domain = usePlugin(Domain)
export const followLists = usePlugin(FollowLists)
export const handles = usePlugin(Handles)
export const logger = usePlugin(Logger)
export const messagingRelayLists = usePlugin(MessagingRelayLists)
export const muteLists = usePlugin(MuteLists)
export const network = usePlugin(Network)
export const pinLists = usePlugin(PinLists)
export const profiles = usePlugin(Profiles)
export const reactions = usePlugin(Reactions)
export const relayLists = usePlugin(RelayLists)
export const relayManagement = usePlugin(RelayManagement)
export const relayMemberLists = usePlugin(RelayMemberLists)
export const relayRoles = usePlugin(RelayRoles)
export const relayStats = usePlugin(RelayStats)
export const relays = usePlugin(Relays)
export const roomLists = usePlugin(RoomLists)
export const roomPinLists = usePlugin(RoomPinLists)
export const rooms = usePlugin(Rooms)
export const router = usePlugin(Router)
export const searchRelayLists = usePlugin(SearchRelayLists)
export const thunks = usePlugin(Thunks)
export const wot = usePlugin(Wot)
export const wraps = usePlugin(Wraps)

// The relays profile search runs against, falling back so search works before the user has any.
export const userSearchRelayUrls = withGetter(
  derived(
    fromApp($app =>
      $app.user ? $app.use(SearchRelayLists).urls($app.user.pubkey).$ : readable<string[]>([]),
    ),
    urls => (urls.length > 0 ? urls : DEFAULT_SEARCH_RELAYS),
  ),
)

// The domain entry points, since almost every read or write goes through one of them.
export const reader = <R extends BaseEventReader, W extends EventWriter<R>, Q extends EventQuery>(
  factory: KindFactory<R, W, Q>,
) => domain.get().reader(factory)

export const writer = <R extends BaseEventReader, W extends EventWriter<R>, Q extends EventQuery>(
  factory: KindFactory<R, W, Q>,
  seed?: R,
) => domain.get().writer(factory, seed)

export const command = (eventWriter: EventWriter<any>) => domain.get().command(eventWriter)
