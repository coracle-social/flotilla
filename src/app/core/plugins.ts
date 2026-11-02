import {derived} from "svelte/store"
import {withGetter} from "@welshman/store"
import {
  BlockedRelayLists,
  BlossomServerLists,
  Deletes,
  Domain,
  Events,
  FollowLists,
  Handles,
  Logger,
  MessagingRelayLists,
  MuteLists,
  Network,
  PinLists,
  Profiles,
  Publisher,
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
  Wot,
  Wraps,
} from "@welshman/app"
import type {Plugin} from "@welshman/app"
import {app} from "@app/core/app"

// Plugins bound to the current app, so login swapping the app repoints every reader.
export const usePlugin = <T>(Ctor: Plugin<T>) => withGetter(derived(app, $app => $app.use(Ctor)))

export const blockedRelayLists = usePlugin(BlockedRelayLists)
export const blossomServerLists = usePlugin(BlossomServerLists)
export const deletes = usePlugin(Deletes)
export const domain = usePlugin(Domain)
export const events = usePlugin(Events)
export const followLists = usePlugin(FollowLists)
export const handles = usePlugin(Handles)
export const logger = usePlugin(Logger)
export const messagingRelayLists = usePlugin(MessagingRelayLists)
export const muteLists = usePlugin(MuteLists)
export const network = usePlugin(Network)
export const pinLists = usePlugin(PinLists)
export const profiles = usePlugin(Profiles)
export const publisher = usePlugin(Publisher)
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
export const wot = usePlugin(Wot)
export const wraps = usePlugin(Wraps)
