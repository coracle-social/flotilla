import {derived, readable, writable} from "svelte/store"
import {ago, MINUTE, now, simpleCache} from "@welshman/lib"
import {ROOM_CREATE_PERMISSION, hexTags, tagValues} from "@welshman/util"
import {Relays} from "@welshman/app"
import {fromApp, relayManagement, user} from "@app/core"
import {deriveEventsForUrl} from "@app/repository"

export type BannedPubkeyItem = {
  pubkey: string
  reason: string
}

export const deriveSpaceBannedPubkeyItems = (url: string) => {
  const store = writable<BannedPubkeyItem[]>([])

  relayManagement
    .get()
    .forUrl(url)
    .listBannedPubkeys()
    .then(({result = []}) => store.set(result))

  return store
}

const deriveSupportedMethodsForPubkey = simpleCache(([, url]: [pubkey: string, url: string]) => {
  let checkedAt = 0

  return readable<string[]>([], set => {
    if (checkedAt < ago(5, MINUTE)) {
      checkedAt = now()

      relayManagement
        .get()
        .forUrl(url)
        .supportedMethods()
        .then(({result = []}) => set(result))
        .catch(error => {
          checkedAt = 0
          console.error(error)
        })
    }
  })
})

// The request is signed as the logged in user and answered for that pubkey, so the methods
// belong to a user as much as to a url and logging in has to swap them out.
export const deriveSpaceSupportedMethods = (url?: string) =>
  fromApp($app => {
    if (url && $app.user) {
      return deriveSupportedMethodsForPubkey($app.user.pubkey, url)
    }

    return readable<string[]>([])
  })

// User

// Holding any management method at all is what makes someone staff. Every control the relay
// answers for is gated on its own method instead, so this is only for the room-level permissions
// NIP-86 has no method for.
export const deriveUserIsSpaceStaff = (url?: string) =>
  derived(deriveSpaceSupportedMethods(url), $methods => $methods.length > 0)

// The one identity a space names as its own, in its NIP-11 `pubkey`. Space-wide content with no
// author to scope it to belongs to that person.
export const deriveUserIsSpaceOwner = (url: string) =>
  derived(
    [user, fromApp($app => $app.use(Relays).one(url))],
    ([$user, $relay]) => $user.pubkey === $relay?.pubkey,
  )

export const deriveUserCanCreateRoom = (url: string) =>
  derived(
    [
      user,
      deriveEventsForUrl(url, [{kinds: [ROOM_CREATE_PERMISSION]}]),
      deriveUserIsSpaceStaff(url),
    ],
    ([$user, $events, $isStaff]) =>
      $isStaff || $events.some(event => tagValues(hexTags("p"), event.tags).includes($user.pubkey)),
  )
