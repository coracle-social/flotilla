import {fromPairs, tryCatch} from "@welshman/lib"
import {displayRelayUrl, isRelayUrl, normalizeRelayUrl} from "@welshman/util"
import {User} from "@welshman/app"
import {app} from "@app/core/app"
import {roomLists} from "@app/core/plugins"
import {PLATFORM_URL} from "@app/core/env"
import {attemptRelayAccess, completeSpaceJoin} from "@app/features/spaces/membership"
import {joinRoom} from "@app/features/spaces/rooms/membership"

export type InviteData = {
  url: string
  claim: string
  h?: string
  code?: string
}

export const parseInviteLink = (invite: string): InviteData | undefined => {
  if (invite.length < 3 || !invite.includes(".")) {
    return
  }

  return (
    tryCatch(() => {
      const params = fromPairs(Array.from(new URL(invite).searchParams))
      const {r: relay = "", c: claim = "", h = "", code = ""} = params
      const url = normalizeRelayUrl(relay)

      if (isRelayUrl(url)) {
        return {url, claim, h: h || undefined, code: code || undefined}
      }
    }) ||
    tryCatch(() => {
      const url = normalizeRelayUrl(invite)

      if (isRelayUrl(url)) {
        return {url, claim: ""}
      }
    })
  )
}

export const makeInviteLink = (data: InviteData) => {
  const params = new URLSearchParams({
    r: displayRelayUrl(data.url),
    c: data.claim,
  })

  if (data.h) {
    params.set("h", data.h)
  }

  if (data.code) {
    params.set("code", data.code)
  }

  return PLATFORM_URL + "/join?" + params.toString()
}

export const acceptInvite = async (data: InviteData, notifications: boolean) => {
  const spaceUrls = roomLists.get().urls(User.require(app.get()).pubkey).get()

  if (!spaceUrls.includes(data.url)) {
    const error = await attemptRelayAccess(data.url, data.claim)

    if (error) {
      return error
    }

    await completeSpaceJoin(data.url, notifications)
  }

  if (data.h && data.code) {
    return joinRoom(data.url, data.h, data.code)
  }
}
