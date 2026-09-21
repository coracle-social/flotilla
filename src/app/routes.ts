import {get, writable} from "svelte/store"
import * as nip19 from "nostr-tools/nip19"
import {page} from "$app/stores"
import {identity, tryCatch} from "@welshman/lib"
import type {TrustedEvent} from "@welshman/util"
import {
  CLASSIFIED,
  EVENT_TIME,
  LONG_FORM,
  MESSAGE,
  PINBOARD,
  POLL,
  THREAD,
  ZAP_GOAL,
  getIdOrAddress,
  hexTags,
  tagSpec,
  tagValue,
  tagValues,
} from "@welshman/util"
import {app, messagingRelayLists, user} from "@app/core"
import {makeChatId} from "@app/chats"
import {entityLink, PLATFORM_URL, PLATFORM_RELAYS} from "@app/env"
import {decodeRelay, encodeRelay} from "@app/relays"
import {DM_KINDS} from "@app/content"
import {navigate, pushModal} from "@app/modal"
import ChatEnable from "@app/components/ChatEnable.svelte"

// State

export let lastChatUrl: string | undefined = undefined

export const lastPageBySpaceUrl = new Map<string, string>()

// A store rather than a class on the node, which each row's class attribute would overwrite.
export const highlightedEvent = writable<string | undefined>(undefined)

// The space the user was in most recently, so the space menu can be opened from a page that isn't
// in a space. A store because it's read from markup, unlike lastChatUrl.
export const lastSpaceUrl = writable<string | undefined>(undefined)

export const setupHistory = () =>
  page.subscribe($page => {
    if ($page.params.relay) {
      const url = decodeRelay($page.params.relay)

      if ($page.url.pathname !== makeSpacePath(url)) {
        lastPageBySpaceUrl.set(url, $page.url.pathname)
      }

      lastSpaceUrl.set(url)
    }

    if ($page.params.chat) {
      lastChatUrl = $page.url.pathname
    }
  })

// Profiles

export const makeProfilePath = (pubkey: string) => `/people/${nip19.npubEncode(pubkey)}`

// Chat

export const makeChatPath = (pubkeys: string[]) => `/chat/${makeChatId(pubkeys)}`

export const makeRoomPath = (url: string, h: string) => `/spaces/${encodeRelay(url)}/${h}`

export const makeSpaceChatPath = (url: string) => makeRoomPath(url, "chat")

export const goToChat = (pubkeys: string[] = [], options: {replaceState?: boolean} = {}) => {
  if (messagingRelayLists.get().urls(user.get().pubkey).get().length === 0) {
    pushModal(ChatEnable, {next: () => goToChat(pubkeys, options)})
  } else if (pubkeys.length === 0) {
    navigate(lastChatUrl ?? "/chat", options)
  } else {
    navigate(makeChatPath(pubkeys), options)
  }
}

// Spaces

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

export const forgetSpacePage = (url: string) => lastPageBySpaceUrl.delete(url)

export const hasSpacePage = (url: string) => lastPageBySpaceUrl.has(url)

export const makeSpaceEntryPath = (url: string) =>
  lastPageBySpaceUrl.get(url) ?? makeSpacePath(url, "about")

export const goToSpace = (url: string, options: {replaceState?: boolean} = {}) =>
  navigate(makeSpaceEntryPath(url), options)

export const goToMovedSpace = (oldUrl: string, newUrl: string) =>
  navigate(get(page).url.pathname.replace(encodeRelay(oldUrl), encodeRelay(newUrl)))

export const goToHome = () => {
  const path = PLATFORM_RELAYS.length > 0 ? makeSpaceEntryPath(PLATFORM_RELAYS[0]) : "/home"

  return navigate(path, {keepModal: true, replaceState: true})
}

// Content types, events

export const makeMessagePath = (url: string, event: TrustedEvent) => {
  const h = tagValue(tagSpec("h"), event.tags)
  const path = h ? makeRoomPath(url, h) : makeSpaceChatPath(url)
  const qp = new URLSearchParams({at: String(event.created_at)})

  return path + "?" + qp.toString()
}

export const makeGoalPath = (url: string, id?: string) => makeSpacePath(url, "goals", id)

export const makeThreadPath = (url: string, id?: string) => makeSpacePath(url, "threads", id)

export const makeClassifiedPath = (url: string, address?: string) =>
  makeSpacePath(url, "classifieds", address)

export const makeArticlePath = (url: string, address?: string) =>
  makeSpacePath(url, "articles", address)

// shareToChat is separate from h because the space-level chat has no room to scope an article to
export const makeArticleCreatePath = (
  url: string,
  {h, shareToChat}: {h?: string; shareToChat?: boolean} = {},
) => {
  const params = new URLSearchParams()

  if (h) {
    params.set("h", h)
  }

  if (shareToChat) {
    params.set("shareToChat", "1")
  }

  const query = params.toString()

  return makeSpacePath(url, "articles", "create") + (query ? "?" + query : "")
}

export const makeCalendarPath = (url: string, address?: string) =>
  makeSpacePath(url, "calendar", address)

export const makePollPath = (url: string, id?: string) => makeSpacePath(url, "polls", id)

// Shelves are selected in place on the library page rather than having their own
// route, so the address goes in a query param.
export const makeLibraryPath = (url: string, address?: string) => {
  const path = makeSpacePath(url, "library")

  if (address) {
    return path + "?" + new URLSearchParams({board: address}).toString()
  }

  return path
}

export const makeContentPath = (url: string, kind: number, idOrAddress?: string) => {
  switch (kind) {
    case ZAP_GOAL:
      return makeGoalPath(url, idOrAddress)
    case THREAD:
      return makeThreadPath(url, idOrAddress)
    case CLASSIFIED:
      return makeClassifiedPath(url, idOrAddress)
    case LONG_FORM:
      return makeArticlePath(url, idOrAddress)
    case EVENT_TIME:
      return makeCalendarPath(url, idOrAddress)
    case PINBOARD:
      return makeLibraryPath(url, idOrAddress)
    case POLL:
      return makePollPath(url, idOrAddress)
  }
}

export const makeEventPath = (event: TrustedEvent, urls: string[]) => {
  if (DM_KINDS.includes(event.kind)) {
    return makeChatPath([event.pubkey, ...tagValues(hexTags("p"), event.tags)])
  }

  if (urls.length > 0) {
    const url = urls[0]

    if (event.kind === MESSAGE) {
      return makeMessagePath(url, event)
    }

    const path = makeContentPath(url, event.kind, getIdOrAddress(event))

    if (path) {
      return path
    }

    const parentKind = tagValue(tagSpec("K"), event.tags)
    const parentIdOrAddress =
      tagValue(tagSpec("A"), event.tags) ?? tagValue(tagSpec("E"), event.tags)

    if (parentKind && parentIdOrAddress) {
      if (parseInt(parentKind) === MESSAGE) {
        return makeMessagePath(url, event)
      }

      const parentPath = makeContentPath(url, parseInt(parentKind), parentIdOrAddress)

      if (parentPath) {
        return parentPath
      }
    }
  }

  return entityLink(nip19.neventEncode({id: event.id, relays: urls}))
}

export const makeEventPermalink = (event: TrustedEvent, url?: string) => {
  const urls = url ? [url] : Array.from(app.get().tracker.getRelays(event.id))
  const path = makeEventPath(event, urls)

  if (path.includes("://")) {
    return path
  }

  const pointer = nip19.neventEncode({id: event.id, relays: urls})

  return `${PLATFORM_URL}${path}${path.includes("?") ? "&" : "?"}event=${pointer}`
}

export const getPermalinkTarget = (url: URL) => {
  const pointer = url.searchParams.get("event")
  const decoded = pointer ? tryCatch(() => nip19.decode(pointer)) : undefined

  return decoded?.type === "nevent" ? decoded.data.id : undefined
}

export const scrollToEvent = (id: string) => {
  const element = document.querySelector(`[data-event="${id}"]`)

  if (element instanceof HTMLElement) {
    element.scrollIntoView({behavior: "smooth", block: "center"})
    highlightedEvent.set(id)
  }

  return element instanceof HTMLElement
}

export const goToEvent = (event: TrustedEvent, options: Record<string, any> = {}) => {
  const urls = Array.from(app.get().tracker.getRelays(event.id))
  const path = makeEventPath(event, urls)

  if (path.includes("://")) {
    window.open(path)
  } else if (!scrollToEvent(event.id)) {
    const replaceState = path.replace(/\?.*$/, "") === get(page).url.pathname

    navigate(path, {replaceState, ...options})
  }
}
