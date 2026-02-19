import {append, identity, uniq} from "@welshman/lib"
import {repository} from "@welshman/app"
import {displayPubkey, getTagValue} from "@welshman/util"
import {PLATFORM_NAME, decodeRelay, getRoom, makeRoomId, splitChatId} from "@app/core/state"

const FALLBACK_APP_NAME = "Flotilla"

const staticTitles = new Map<string, string>([
  ["/", "Redirecting"],
  ["/home", "Home"],
  ["/discover", "Join a Space"],
  ["/spaces", "Your Spaces"],
  ["/spaces/create", "Create a Space"],
  ["/spaces/[relay]", "Space"],
  ["/spaces/[relay]/chat", "Space Chat"],
  ["/spaces/[relay]/recent", "Recent Activity"],
  ["/spaces/[relay]/threads", "Threads"],
  ["/spaces/[relay]/classifieds", "Classifieds"],
  ["/spaces/[relay]/calendar", "Calendar"],
  ["/spaces/[relay]/goals", "Goals"],
  ["/chat", "Messages"],
  ["/join", "Join Space"],
  ["/people", "Find People"],
  ["/settings/about", "About"],
  ["/settings/profile", "Profile Settings"],
  ["/settings/content", "Content Settings"],
  ["/settings/privacy", "Privacy Settings"],
  ["/settings/relays", "Relay Settings"],
  ["/settings/alerts", "Alert Settings"],
  ["/settings/wallet", "Wallet Settings"],
  ["/[bech32]", "Opening Link"],
])

const eventRoutes = new Set([
  "/spaces/[relay]/threads/[id]",
  "/spaces/[relay]/goals/[id]",
  "/spaces/[relay]/calendar/[address]",
  "/spaces/[relay]/classifieds/[address]",
])

type RouteParams = Record<string, string | undefined>

type TitlePage = {
  route: {id: string | null}
  params: RouteParams
}

type PageTitleContext = {
  page: TitlePage
  pubkey: string | undefined
}

const getRoomTitle = (params: RouteParams) => {
  const relay = params.relay
  const h = params.h

  if (!relay || !h) {
    return "Room"
  }

  const url = decodeRelay(relay)

  return getRoom(makeRoomId(url, h))?.name || "Room"
}

const getEventForTitle = (routeId: string, params: RouteParams) => {
  if (!eventRoutes.has(routeId)) {
    return
  }

  const eventId = params.id || params.address

  if (!eventId) {
    return
  }

  return repository.getEvent(eventId)
}

const getChatTitle = (chatId: string | undefined, pubkey: string | undefined) => {
  if (!chatId) {
    return "Chat"
  }

  const chatPeers = pubkey ? uniq(append(pubkey, splitChatId(chatId))) : splitChatId(chatId)
  const others = pubkey ? chatPeers.filter(pk => pk !== pubkey) : chatPeers

  if (others.length === 1) {
    return `Chat with ${displayPubkey(others[0])}`
  }

  if (others.length > 1) {
    return `Group chat (${others.length})`
  }

  return "Chat"
}

export const makeTitle = (...parts: Array<string | undefined>) =>
  parts
    .map(part => part?.trim() || "")
    .filter(identity)
    .join(" · ") ||
  PLATFORM_NAME ||
  FALLBACK_APP_NAME

export const getPageTitle = ({page, pubkey}: PageTitleContext) => {
  const routeId = page.route.id || ""
  const staticTitle = staticTitles.get(routeId)

  if (staticTitle) {
    return makeTitle(staticTitle)
  }

  if (routeId === "/chat/[chat]") {
    return makeTitle(getChatTitle(page.params.chat, pubkey))
  }

  if (routeId === "/spaces/[relay]/[h]") {
    return makeTitle(getRoomTitle(page.params))
  }

  const event = getEventForTitle(routeId, page.params)

  if (routeId === "/spaces/[relay]/threads/[id]") {
    return makeTitle(getTagValue("title", event?.tags || []) || "Thread")
  }

  if (routeId === "/spaces/[relay]/calendar/[address]") {
    return makeTitle(getTagValue("title", event?.tags || []) || "Event")
  }

  if (routeId === "/spaces/[relay]/classifieds/[address]") {
    return makeTitle(getTagValue("title", event?.tags || []) || "Listing")
  }

  if (routeId === "/spaces/[relay]/goals/[id]") {
    return makeTitle(event?.content || getTagValue("summary", event?.tags || []) || "Goal")
  }

  return makeTitle()
}
