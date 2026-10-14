import {derived} from "svelte/store"
import {getAddress, tagValues, topicTags} from "@welshman/util"
import type {TrustedEvent} from "@welshman/util"
import {withGetter} from "@welshman/store"
import {user, userMuteList} from "@app/core/user"
import {profiles} from "@app/core/plugins"
import {getParents} from "@app/features/social"

export const isEventMuted = withGetter(
  derived([user, userMuteList], ([$user, $muteList]) => {
    const mutedEvents = new Set($muteList?.ids())
    const mutedPubkeys = new Set($muteList?.pubkeys())
    const mutedAddresses = new Set($muteList?.addresses())
    const mutedTopics = new Set($muteList?.topics())
    // Words come from any client, so a blank or a regex character must not mute everyone or throw.
    const mutedWords = ($muteList?.words() ?? [])
      .map(word => word.toLowerCase().trim())
      .filter(Boolean)
      .map(word => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    const regex = mutedWords.length > 0 ? new RegExp(`\\b(${mutedWords.join("|")})\\b`) : undefined

    return (e: TrustedEvent) => {
      if (!$muteList) {
        return false
      }
      if ($user.pubkey === e.pubkey) {
        return false
      }
      if (mutedPubkeys.has(e.pubkey)) {
        return true
      }
      if (mutedEvents.has(e.id)) {
        return true
      }
      if (mutedAddresses.has(getAddress(e))) {
        return true
      }
      if (getParents(e).some(v => mutedEvents.has(v) || mutedAddresses.has(v))) {
        return true
      }
      if (tagValues(topicTags("t"), e.tags).some(t => mutedTopics.has(t))) {
        return true
      }

      if (regex) {
        const profile = profiles.get().get(e.pubkey)

        if (profile?.display().toLowerCase().match(regex)) {
          return true
        }
        if (profile?.nip05()?.toLowerCase().match(regex)) {
          return true
        }
      }

      return false
    }
  }),
)

export const derivePubkeyMuted = (pubkey: string) =>
  derived(userMuteList, $muteList => ($muteList?.pubkeys() ?? []).includes(pubkey))
