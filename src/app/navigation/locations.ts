import {get, writable} from "svelte/store"
import * as nip19 from "nostr-tools/nip19"
import {page} from "$app/state"
import {tryCatch} from "@welshman/lib"
import type {Maybe} from "@welshman/lib"
import type {TrustedEvent} from "@welshman/util"
import {
  COMMENT,
  LONG_FORM,
  MESSAGE,
  Address,
  EventRef,
  NOTE,
  getIdOrAddress,
  hexTags,
  tagSpec,
  tagValue,
  tagValues,
} from "@welshman/util"
import {Comment} from "@welshman/domain"
import {DM_KINDS} from "@lib/util"
import {app} from "@app/core/app"
import {reader} from "@app/core/domain"
import {PLATFORM_URL} from "@app/core/env"
import {userSpaceUrls} from "@app/features/spaces/urls"
import {navigate} from "@app/navigation/navigate"
import type {NavigateOptions} from "@app/navigation/navigate"
import {openNote} from "@app/navigation/overlays"
import * as pages from "@app/navigation/pages"

// What an event is activity on: the root a comment sits under, or the event itself.
export const getActivityTarget = (event: TrustedEvent) => {
  if (event.kind === COMMENT) {
    const root = reader(Comment)(event).root()
    const idOrAddress = root?.getAddressOrId()

    if (root?.kind && idOrAddress) {
      return {kind: root.kind, idOrAddress}
    }
  }

  return {kind: event.kind, idOrAddress: getIdOrAddress(event)}
}

const getMessagePath = (url: string, event: TrustedEvent) => {
  const h = tagValue(tagSpec("h"), event.tags)
  const at = event.created_at

  return h ? pages.room.path({url, h, at}) : pages.spaceChat.path({url, at})
}

// An article is ordinary nostr content, so one outside the user's spaces reads on a page of its own.
const getArticlePath = (address: string, urls: string[]) => {
  const spaceUrls = get(userSpaceUrls)
  const url = urls.find(candidate => spaceUrls.includes(candidate))

  return url
    ? pages.article.path({url, address})
    : pages.networkArticle.path({address, relays: urls.slice(0, 3)})
}

// The page an event lives on, given the relays it was seen on.
export const getEventPath = (event: TrustedEvent, urls: string[]): Maybe<string> => {
  if (DM_KINDS.includes(event.kind)) {
    return pages.conversation.path({
      pubkeys: [event.pubkey, ...tagValues(hexTags("p"), event.tags)],
    })
  }

  const {kind, idOrAddress} = getActivityTarget(event)

  if (kind === LONG_FORM && idOrAddress && Address.isAddress(idOrAddress)) {
    return getArticlePath(idOrAddress, urls)
  }

  if (urls.length > 0) {
    const url = urls[0]

    // A comment inherits the h of the message it answers, so both anchor the same transcript.
    if (kind === MESSAGE) {
      return getMessagePath(url, event)
    }

    const path = pages.makeContentPath(url, kind, idOrAddress)

    if (path) {
      return path
    }
  }

  // A note belongs to no space, so its path carries the relays it was found on.
  if (event.kind === NOTE) {
    return pages.note.path({ref: EventRef.fromEvent(event, urls.slice(0, 3))})
  }
}

export const makeEventPermalink = (event: TrustedEvent, url?: string) => {
  const urls = url ? [url] : Array.from(app.get().tracker.getRelays(event.id))
  const path = getEventPath(event, urls)
  const pointer = nip19.neventEncode({id: event.id, relays: urls})

  if (path) {
    return `${PLATFORM_URL}${path}${path.includes("?") ? "&" : "?"}event=${pointer}`
  } else {
    return `${PLATFORM_URL}/${pointer}`
  }
}

export const getPermalinkTarget = (url: URL) => {
  const pointer = url.searchParams.get("event")
  const decoded = pointer ? tryCatch(() => nip19.decode(pointer)) : undefined

  return decoded?.type === "nevent" ? decoded.data.id : undefined
}

// A store rather than a class on the node, which each row's class attribute would overwrite.
export const highlightedEvent = writable<string | undefined>(undefined)

export const scrollToEvent = (id: string) => {
  const element = document.querySelector(`[data-event="${id}"]`)

  if (element instanceof HTMLElement) {
    element.scrollIntoView({behavior: "smooth", block: "center"})
    highlightedEvent.set(id)
  }

  return element instanceof HTMLElement
}

export const goToEvent = (event: TrustedEvent, options: NavigateOptions = {}) => {
  const urls = Array.from(app.get().tracker.getRelays(event.id))
  // A note has a page of its own and still opens as an overlay, over whatever is on screen.
  const path = event.kind === NOTE ? undefined : getEventPath(event, urls)

  if (path) {
    if (!scrollToEvent(event.id)) {
      const replaceState = path.replace(/\?.*$/, "") === page.url.pathname

      navigate(path, {replaceState, ...options})
    }
  } else {
    // A kind with no page of its own opens there too, rather than in another client.
    openNote(EventRef.fromEvent(event, urls), {replaceState: options.replaceState})
  }
}
