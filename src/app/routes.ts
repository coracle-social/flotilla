import theme from "tailwindcss/defaultTheme"
import {get} from "svelte/store"
import * as nip19 from "nostr-tools/nip19"
import {goto} from "$app/navigation"
import {page} from "$app/stores"
import {identity} from "@welshman/lib"
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
import {app, messagingRelayLists, relays, user} from "@app/core"
import {makeChatId} from "@app/chats"
import {entityLink, PLATFORM_URL, PLATFORM_RELAYS} from "@app/env"
import {encodeRelay} from "@app/relays"
import {DM_KINDS} from "@app/content"
import {ROOM} from "@app/rooms"
import {pushModal} from "@app/modal"
import ChatEnable from "@app/components/ChatEnable.svelte"

// State

export let lastChatUrl: string | undefined = undefined

export const lastPageBySpaceUrl = new Map<string, string>()

export const setupHistory = () =>
  page.subscribe($page => {
    if ($page.params.relay) {
      lastPageBySpaceUrl.set($page.params.relay, $page.url.pathname)
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
    goto(lastChatUrl ?? "/chat", options)
  } else {
    goto(makeChatPath(pubkeys), options)
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

export const goToSpace = (url: string, hash = "") => {
  const prevPath = lastPageBySpaceUrl.get(encodeRelay(url))

  if (prevPath && prevPath !== makeSpacePath(url)) {
    return goto(prevPath + hash, {replaceState: true})
  }

  if (!relays.get().get(url)?.hasNip(29)) {
    return goto(makeSpaceChatPath(url) + hash, {replaceState: true})
  }

  if (window.matchMedia(`(min-width: ${theme.screens.md})`).matches) {
    return goto(makeSpacePath(url, "about") + hash, {replaceState: true})
  }

  return goto(makeSpacePath(url) + hash, {replaceState: true})
}

export const goToMovedSpace = (oldUrl: string, newUrl: string) =>
  goto(get(page).url.pathname.replace(encodeRelay(oldUrl), encodeRelay(newUrl)))

export const goToHome = () => {
  if (PLATFORM_RELAYS.length > 0) {
    return goToSpace(PLATFORM_RELAYS[0], get(page).url.hash)
  }

  return goto("/home" + get(page).url.hash)
}

// Content types, events

export const makeMessagePath = (url: string, event: TrustedEvent) => {
  const h = tagValue(tagSpec(ROOM), event.tags)
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

  return `${PLATFORM_URL}${path}#${nip19.neventEncode({id: event.id, relays: urls})}`
}

export const scrollToEvent = (id: string) => {
  const element = document.querySelector(`[data-event="${id}"]`)

  if (element instanceof HTMLElement) {
    element.scrollIntoView({behavior: "smooth", block: "center"})
    element.classList.add("highlight-target")
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

    goto(path, {replaceState, ...options})
  }
}
