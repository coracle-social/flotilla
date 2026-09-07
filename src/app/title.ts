import {identity, uniq} from "@welshman/lib"
import {tagSpec, tagValue} from "@welshman/util"
import {displayPubkey} from "@welshman/domain"
import {makeRoomKey} from "@welshman/app"
import {decodePubkey} from "@lib/util"
import {app, profiles, rooms} from "@app/core"
import {PLATFORM_NAME} from "@app/env"
import {decodeRelay} from "@app/relays"

const FALLBACK_APP_NAME = "Flotilla"

const staticTitles = new Map<string, string>([
  ["/", "Redirecting"],
  ["/home", "Home"],
  ["/spaces", "Spaces"],
  ["/spaces/create", "Create a Space"],
  ["/spaces/[relay]", "Space"],
  ["/spaces/[relay]/chat", "Space Chat"],
  ["/spaces/[relay]/recent", "Recent Activity"],
  ["/spaces/[relay]/threads", "Threads"],
  ["/spaces/[relay]/classifieds", "Classifieds"],
  ["/spaces/[relay]/articles", "Articles"],
  ["/spaces/[relay]/articles/create", "Write an Article"],
  ["/spaces/[relay]/calendar", "Calendar"],
  ["/spaces/[relay]/goals", "Goals"],
  ["/spaces/[relay]/polls", "Polls"],
  ["/spaces/[relay]/admin", "Space Administration"],
  ["/chat", "Messages"],
  ["/join", "Join Space"],
  ["/settings/about", "About"],
  ["/settings/profile", "Profile Settings"],
  ["/settings/content", "Content Settings"],
  ["/settings/privacy", "Privacy Settings"],
  ["/settings/relays", "Relay Settings"],
  ["/settings/hosting", "Hosting"],
  ["/settings/alerts", "Alert Settings"],
  ["/settings/wallet", "Wallet Settings"],
  ["/[bech32]", "Opening Link"],
])

const eventRoutes = new Set([
  "/spaces/[relay]/threads/[id]",
  "/spaces/[relay]/goals/[id]",
  "/spaces/[relay]/calendar/[address]",
  "/spaces/[relay]/classifieds/[address]",
  "/spaces/[relay]/articles/[address]",
  "/spaces/[relay]/polls/[id]",
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

  const room = rooms.get().get(makeRoomKey(decodeRelay(relay), h))

  return room?.meta?.name() || "Room"
}

const getEventForTitle = (routeId: string, params: RouteParams) => {
  if (!eventRoutes.has(routeId)) {
    return
  }

  const eventId = params.id || params.address

  if (!eventId) {
    return
  }

  return app.get().repository.getEvent(eventId)
}

const getChatTitle = (chatId: string | undefined, pubkey: string | undefined) => {
  if (!chatId) {
    return "Chat"
  }

  // Read the id directly rather than through splitChatId, which resolves it against the signed-in
  // user and throws when there isn't one.
  const others = uniq(chatId.split(",")).filter(pk => pk !== pubkey)

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

  if (routeId === "/people/[npub]") {
    const profilePubkey = decodePubkey(page.params.npub!)

    if (profilePubkey) {
      return makeTitle(profiles.get().display(profilePubkey).get())
    }
  }

  if (routeId === "/spaces/[relay]/[h]") {
    return makeTitle(getRoomTitle(page.params))
  }

  const event = getEventForTitle(routeId, page.params)

  if (routeId === "/spaces/[relay]/threads/[id]") {
    return makeTitle(tagValue(tagSpec("title"), event?.tags || []) || "Thread")
  }

  if (routeId === "/spaces/[relay]/calendar/[address]") {
    return makeTitle(tagValue(tagSpec("title"), event?.tags || []) || "Event")
  }

  if (routeId === "/spaces/[relay]/classifieds/[address]") {
    return makeTitle(tagValue(tagSpec("title"), event?.tags || []) || "Listing")
  }

  if (routeId === "/spaces/[relay]/articles/[address]") {
    return makeTitle(tagValue(tagSpec("title"), event?.tags || []) || "Article")
  }

  if (routeId === "/spaces/[relay]/goals/[id]") {
    return makeTitle(event?.content || tagValue(tagSpec("summary"), event?.tags || []) || "Goal")
  }

  return makeTitle()
}
