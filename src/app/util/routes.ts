import type {Page} from "@sveltejs/kit"
import {get} from "svelte/store"
import * as nip19 from "nostr-tools/nip19"
import {goto} from "$app/navigation"
import {nthEq, sleep} from "@welshman/lib"
import type {TrustedEvent} from "@welshman/util"
import {getAddress} from "@welshman/util"
import {tracker, loadRelay} from "@welshman/app"
import {scrollToEvent} from "@lib/html"
import {identity} from "@welshman/lib"
import {
  getTagValue,
  MESSAGE,
  THREAD,
  CLASSIFIED,
  ZAP_GOAL,
  EVENT_TIME,
  getPubkeyTagValues,
} from "@welshman/util"
import {
  makeChatId,
  entityLink,
  decodeRelay,
  encodeRelay,
  userSpaceUrls,
  hasNip29,
  DM_KINDS,
  ROOM,
} from "@app/core/state"
import {lastPageBySpaceUrl} from "@app/util/history"

export const makeSpacePath = (url: string, ...extra: (string | undefined)[]) => {
  let path = `/spaces/${encodeRelay(url)}`

  if (extra.length > 0) {
    path +=
      "/" +
      extra
        .filter(identity)
        .map(s => encodeURIComponent(s as string))
        .join("/")
  }

  return path
}

export const goToSpace = async (url: string) => {
  const prevPath = lastPageBySpaceUrl.get(encodeRelay(url))

  if (prevPath) {
    goto(prevPath)
  } else if (hasNip29(await loadRelay(url))) {
    goto(makeSpacePath(url, "recent"))
  } else {
    goto(makeSpacePath(url, "chat"))
  }
}

export const makeChatPath = (pubkeys: string[]) => `/chat/${makeChatId(pubkeys)}`

export const makeRoomPath = (url: string, h: string) => `/spaces/${encodeRelay(url)}/${h}`

export const makeSpaceChatPath = (url: string) => makeRoomPath(url, "chat")

export const makeGoalPath = (url: string, id?: string) => makeSpacePath(url, "goals", id)

export const makeThreadPath = (url: string, id?: string) => makeSpacePath(url, "threads", id)

export const makeClassifiedPath = (url: string, address?: string) =>
  makeSpacePath(url, "classifieds", address)

export const makeCalendarPath = (url: string, address?: string) =>
  makeSpacePath(url, "calendar", address)

export const getPrimaryNavItem = ($page: Page) => $page.route?.id?.split("/")[1]

export const getPrimaryNavItemIndex = ($page: Page) => {
  const urls = get(userSpaceUrls)

  switch (getPrimaryNavItem($page)) {
    case "discover":
      return urls.length + 2
    case "spaces": {
      const routeUrl = decodeRelay($page.params.relay || "")

      return urls.findIndex(url => url === routeUrl) + 1
    }
    case "settings":
      return urls.length + 3
    default:
      return 0
  }
}

export const goToEvent = async (event: TrustedEvent, options: Record<string, any> = {}) => {
  const urls = Array.from(tracker.getRelays(event.id))
  const path = await getEventPath(event, urls)

  if (path.includes("://")) {
    window.open(path)
  } else {
    goto(path, options)

    await sleep(300)
    await scrollToEvent(event.id)
  }
}

export const getEventPath = async (event: TrustedEvent, urls: string[]) => {
  if (DM_KINDS.includes(event.kind)) {
    return makeChatPath([event.pubkey, ...getPubkeyTagValues(event.tags)])
  }

  const h = getTagValue(ROOM, event.tags)

  if (urls.length > 0) {
    const url = urls[0]

    if (event.kind === ZAP_GOAL) {
      return makeGoalPath(url, event.id)
    }

    if (event.kind === THREAD) {
      return makeThreadPath(url, event.id)
    }

    if (event.kind === CLASSIFIED) {
      return makeClassifiedPath(url, getAddress(event))
    }

    if (event.kind === EVENT_TIME) {
      return makeCalendarPath(url, getAddress(event))
    }

    if (event.kind === MESSAGE) {
      return h ? makeRoomPath(url, h) : makeSpacePath(url, "chat")
    }

    const address = event.tags.find(nthEq(0, "A"))?.[1]
    const kind = event.tags.find(nthEq(0, "K"))?.[1]
    const id = event.tags.find(nthEq(0, "E"))?.[1]

    if (id && kind) {
      if (parseInt(kind) === ZAP_GOAL) {
        return makeGoalPath(url, id)
      }

      if (parseInt(kind) === THREAD) {
        return makeThreadPath(url, id)
      }

      if (parseInt(kind) === MESSAGE) {
        return h ? makeRoomPath(url, h) : makeSpacePath(url, "chat")
      }
    }

    if (address && kind) {
      if (parseInt(kind) === CLASSIFIED) {
        return makeClassifiedPath(url, address)
      }

      if (parseInt(kind) === EVENT_TIME) {
        return makeCalendarPath(url, address)
      }
    }
  }

  return entityLink(nip19.neventEncode({id: event.id, relays: urls}))
}

export const getRoomItemPath = (url: string, event: TrustedEvent) => {
  switch (event.kind) {
    case THREAD:
      return makeThreadPath(url, event.id)
    case CLASSIFIED:
      return makeClassifiedPath(url, getAddress(event))
    case ZAP_GOAL:
      return makeGoalPath(url, event.id)
    case EVENT_TIME:
      return makeCalendarPath(url, getAddress(event))
  }
}
