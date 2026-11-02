import {derived} from "svelte/store"
import {noop, removeUndefined, shuffle} from "@welshman/lib"
import type {Maybe} from "@welshman/lib"
import {displayPubkey} from "@welshman/domain"
import type {ProfileReader} from "@welshman/domain"
import {Profiles} from "@welshman/app"
import {fromApp} from "@app/core/app"
import {userFollowList} from "@app/core/user"
import {profiles} from "@app/core/plugins"
import {DEFAULT_PUBKEYS} from "@app/core/env"

const profileIndex = fromApp($app => $app.use(Profiles).index.$)

export const deriveProfilesByPubkey = (pubkeys: string[], url?: string) => {
  const relays = removeUndefined([url])

  // Load profiles
  for (const pubkey of pubkeys) {
    if (pubkey) {
      profiles.get().load(pubkey, relays).catch(noop)
    }
  }

  return derived(
    profileIndex,
    $index => new Map(pubkeys.map(pubkey => [pubkey, $index.get(pubkey)])),
    new Map<string, Maybe<ProfileReader>>(),
  )
}

export const deriveDisplaysByPubkey = (pubkeys: string[], url?: string) =>
  derived(
    deriveProfilesByPubkey(pubkeys, url),
    $profiles =>
      new Map(
        pubkeys.map(pubkey => [
          pubkey,
          pubkey ? ($profiles.get(pubkey)?.display() ?? displayPubkey(pubkey)) : "",
        ]),
      ),
    new Map<string, string>(),
  )

export const bootstrapPubkeys = derived(userFollowList, $userFollowList => {
  const appPubkeys = DEFAULT_PUBKEYS.split(",")
  const userPubkeys = shuffle($userFollowList?.pubkeys() ?? [])

  return userPubkeys.length > 5 ? userPubkeys : [...userPubkeys, ...appPubkeys]
})
