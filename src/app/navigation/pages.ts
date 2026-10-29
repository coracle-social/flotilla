import * as nip19 from "nostr-tools/nip19"
import type {Page} from "@sveltejs/kit"
import {append, remove, sort, tryCatch, uniq} from "@welshman/lib"
import type {Maybe, MaybeAsync} from "@welshman/lib"
import {
  CLASSIFIED,
  EVENT_TIME,
  LONG_FORM,
  PINBOARD,
  POLL,
  THREAD,
  ZAP_GOAL,
  Address,
  EventRef,
  normalizeRelayUrl,
} from "@welshman/util"
import type {IEventRef, TrustedEvent} from "@welshman/util"
import {
  Article,
  Classified,
  Pinboard,
  Poll,
  Thread,
  TimeEvent,
  ZapGoal,
  displayPubkey,
} from "@welshman/domain"
import {makeRoomKey} from "@welshman/app"
import {decodePubkey} from "@lib/util"
import {app} from "@app/core/app"
import {user} from "@app/core/user"
import {profiles, rooms} from "@app/core/plugins"
import {reader} from "@app/core/domain"
import {defineRoute, defineStaticRoute} from "@app/navigation/define"
import type {PageId} from "@app/navigation/define"

// A relay url as a route segment, without its scheme or trailing slash.
export const encodeRelay = (url: string) =>
  encodeURIComponent(
    normalizeRelayUrl(url)
      .replace(/^wss:\/\//, "")
      .replace(/\/$/, ""),
  )

export const decodeRelay = (url: string) => normalizeRelayUrl(decodeURIComponent(url))

const encodeSpace = ({url}: {url: string}) => ({relay: encodeRelay(url)})

const decodeSpace = ({relay}: {relay: string}) => ({url: decodeRelay(relay)})

const readTitle = async (
  idOrAddress: string,
  fallback: string,
  read: (event: TrustedEvent) => Maybe<string>,
) => {
  const event = await app.get().repository.getEvent(idOrAddress)

  return (event && read(event)) || fallback
}

// Conversations are named by everyone in them but the user, or the user alone for notes to self.

export const getConversationPubkeys = (pubkeys: string[]) =>
  sort(uniq(append(user.get().pubkey, pubkeys)))

export const makeConversationId = (pubkeys: string[]) => {
  const userPubkey = user.get().pubkey
  const otherPubkeys = remove(userPubkey, uniq(pubkeys))
  const visiblePubkeys = otherPubkeys.length === 0 ? [userPubkey] : otherPubkeys

  return sort(visiblePubkeys).join(",")
}

const getConversationTitle = (pubkeys: string[]) => {
  const others = pubkeys.filter(pubkey => pubkey !== app.get().user?.pubkey)

  if (others.length === 1) {
    return `Chat with ${displayPubkey(others[0])}`
  }

  if (others.length > 1) {
    return `Group chat (${others.length})`
  }

  return "Chat"
}

// Pages

export const root = defineStaticRoute("/", "")

export const home = defineStaticRoute("/home", "Home")

export const bookmarks = defineStaticRoute("/bookmarks", "Bookmarks")

export const join = defineStaticRoute("/join", "Join Space")

export const share = defineStaticRoute("/share", "Share")

export const entity = defineStaticRoute("/[bech32]", "Opening Link")

export const profile = defineRoute("/people/[npub]", {
  encode: ({pubkey}: {pubkey: Maybe<string>}) => ({npub: pubkey ? nip19.npubEncode(pubkey) : ""}),
  decode: ({npub}) => ({pubkey: decodePubkey(npub)}),
  title: ({pubkey}) => (pubkey ? profiles.get().display(pubkey).get() : "Profile"),
})

export const note = defineRoute("/notes/[nevent]", {
  encode: ({ref}: {ref: Maybe<IEventRef>}) => ({
    nevent: (ref && new EventRef(ref).toNip19()) ?? "",
  }),
  decode: ({nevent}) => ({ref: EventRef.fromNip19(nevent)}),
  title: () => "Note",
})

// Messages

export const messages = defineStaticRoute("/chat", "Messages")

export const conversation = defineRoute("/chat/[chat]", {
  encode: ({pubkeys}: {pubkeys: string[]}) => ({chat: makeConversationId(pubkeys)}),
  decode: ({chat}) => ({pubkeys: chat.split(",")}),
  title: ({pubkeys}) => getConversationTitle(pubkeys),
})

// Spaces

export const spaces = defineStaticRoute("/spaces", "Spaces")

export const spaceCreate = defineStaticRoute("/spaces/create", "Create a Space")

export const space = defineRoute("/spaces/[relay]", {
  encode: encodeSpace,
  decode: decodeSpace,
  title: () => "Space",
})

export const spaceAbout = defineRoute("/spaces/[relay]/about", {
  encode: encodeSpace,
  decode: decodeSpace,
  title: () => "About",
})

export const spaceAdmin = defineRoute("/spaces/[relay]/admin", {
  encode: encodeSpace,
  decode: decodeSpace,
  title: () => "Space Administration",
})

type MessagesParams = {url: string; at?: number}

const decodeAt = (search: URLSearchParams) => parseInt(search.get("at") ?? "") || undefined

export const spaceChat = defineRoute("/spaces/[relay]/chat", {
  encode: encodeSpace,
  decode: ({relay}, search): MessagesParams => ({url: decodeRelay(relay), at: decodeAt(search)}),
  search: ({at}: MessagesParams) => ({at: at?.toString()}),
  title: () => "Space Chat",
})

type RoomParams = MessagesParams & {h: string}

// A room's h goes into its path as is, which is also how unread state has always been keyed.
export const room = defineRoute("/spaces/[relay]/[h]", {
  encode: ({url, h}: RoomParams) => ({relay: encodeRelay(url), h}),
  decode: ({relay, h}, search): RoomParams => ({url: decodeRelay(relay), h, at: decodeAt(search)}),
  search: ({at}) => ({at: at?.toString()}),
  title: ({url, h}) => rooms.get().get(makeRoomKey(url, h))?.meta?.name() || "Room",
})

// Content

type ContentByIdParams = {url: string; id: string}

type ContentByAddressParams = {url: string; address: string}

const encodeById = ({url, id}: ContentByIdParams) => ({
  relay: encodeRelay(url),
  id: encodeURIComponent(id),
})

const decodeById = ({relay, id}: {relay: string; id: string}) => ({url: decodeRelay(relay), id})

const encodeByAddress = ({url, address}: ContentByAddressParams) => ({
  relay: encodeRelay(url),
  address: encodeURIComponent(address),
})

const decodeByAddress = ({relay, address}: {relay: string; address: string}) => ({
  url: decodeRelay(relay),
  address,
})

export const threads = defineRoute("/spaces/[relay]/threads", {
  encode: encodeSpace,
  decode: decodeSpace,
  title: () => "Threads",
})

export const thread = defineRoute("/spaces/[relay]/threads/[id]", {
  encode: encodeById,
  decode: decodeById,
  title: ({id}) => readTitle(id, "Thread", event => reader(Thread)(event).title()),
})

export const goals = defineRoute("/spaces/[relay]/goals", {
  encode: encodeSpace,
  decode: decodeSpace,
  title: () => "Goals",
})

export const goal = defineRoute("/spaces/[relay]/goals/[id]", {
  encode: encodeById,
  decode: decodeById,
  title: ({id}) =>
    readTitle(id, "Goal", event => event.content || reader(ZapGoal)(event).summary()),
})

export const polls = defineRoute("/spaces/[relay]/polls", {
  encode: encodeSpace,
  decode: decodeSpace,
  title: () => "Polls",
})

export const poll = defineRoute("/spaces/[relay]/polls/[id]", {
  encode: encodeById,
  decode: decodeById,
  title: ({id}) => readTitle(id, "Poll", event => reader(Poll)(event).title()),
})

export const calendar = defineRoute("/spaces/[relay]/calendar", {
  encode: encodeSpace,
  decode: decodeSpace,
  title: () => "Calendar",
})

export const calendarEvent = defineRoute("/spaces/[relay]/calendar/[address]", {
  encode: encodeByAddress,
  decode: decodeByAddress,
  title: ({address}) => readTitle(address, "Event", event => reader(TimeEvent)(event).title()),
})

type ClassifiedsParams = {url: string; topic?: string}

export const classifieds = defineRoute("/spaces/[relay]/classifieds", {
  encode: encodeSpace,
  decode: ({relay}, search): ClassifiedsParams => ({
    url: decodeRelay(relay),
    topic: search.get("topic") ?? undefined,
  }),
  search: ({topic}) => ({topic}),
  title: () => "Classifieds",
})

export const classified = defineRoute("/spaces/[relay]/classifieds/[address]", {
  encode: encodeByAddress,
  decode: decodeByAddress,
  title: ({address}) => readTitle(address, "Listing", event => reader(Classified)(event).title()),
})

export const articles = defineRoute("/spaces/[relay]/articles", {
  encode: encodeSpace,
  decode: decodeSpace,
  title: () => "Articles",
})

type ArticleCreateParams = {url: string; h?: string; shareToChat?: boolean}

// shareToChat is separate from h because the space-level chat has no room to scope an article to
export const articleCreate = defineRoute("/spaces/[relay]/articles/create", {
  encode: encodeSpace,
  decode: ({relay}, search): ArticleCreateParams => ({
    url: decodeRelay(relay),
    h: search.get("h") ?? undefined,
    shareToChat: search.has("shareToChat"),
  }),
  search: ({h, shareToChat}) => ({h, shareToChat: shareToChat ? "1" : undefined}),
  title: () => "Write an Article",
})

// The same composer with no space behind it, for an article published to the network.
export const networkArticleCreate = defineStaticRoute("/articles/create", "Write an Article")

const readArticleTitle = (address: string) =>
  readTitle(address, "Article", event => reader(Article)(event).title())

export const article = defineRoute("/spaces/[relay]/articles/[address]", {
  encode: encodeByAddress,
  decode: decodeByAddress,
  title: ({address}) => readArticleTitle(address),
})

// The same reader with no space behind it, for an article found on the network.
export const networkArticle = defineRoute("/articles/[naddr]", {
  encode: ({address, relays = []}: {address: string; relays?: string[]}) => ({
    naddr: Address.from(address, relays).toNaddr(),
  }),
  decode: ({naddr}) => {
    const address = tryCatch(() => Address.fromNaddr(naddr))

    return {address: address?.toString() ?? "", relays: address?.relays ?? []}
  },
  title: ({address}) => readArticleTitle(address),
})

export const library = defineRoute("/spaces/[relay]/library", {
  encode: encodeSpace,
  decode: decodeSpace,
  title: () => "Library",
})

export const board = defineRoute("/spaces/[relay]/library/[address]", {
  encode: encodeByAddress,
  decode: decodeByAddress,
  title: ({address}) => readTitle(address, "Board", event => reader(Pinboard)(event).title()),
})

// The page for a content kind: its list without an id or address, or the item itself.
export const makeContentPath = (url: string, kind: number, idOrAddress?: string) => {
  switch (kind) {
    case ZAP_GOAL:
      return idOrAddress ? goal.path({url, id: idOrAddress}) : goals.path({url})
    case THREAD:
      return idOrAddress ? thread.path({url, id: idOrAddress}) : threads.path({url})
    case CLASSIFIED:
      return idOrAddress ? classified.path({url, address: idOrAddress}) : classifieds.path({url})
    case LONG_FORM:
      return idOrAddress ? article.path({url, address: idOrAddress}) : articles.path({url})
    case EVENT_TIME:
      return idOrAddress ? calendarEvent.path({url, address: idOrAddress}) : calendar.path({url})
    case PINBOARD:
      return idOrAddress ? board.path({url, address: idOrAddress}) : library.path({url})
    case POLL:
      return idOrAddress ? poll.path({url, id: idOrAddress}) : polls.path({url})
  }
}

// Settings

export const settingsAbout = defineStaticRoute("/settings/about", "About")

export const settingsProfile = defineStaticRoute("/settings/profile", "Profile Settings")

export const settingsContent = defineStaticRoute("/settings/content", "Content Settings")

export const settingsPrivacy = defineStaticRoute("/settings/privacy", "Privacy Settings")

export const settingsHosting = defineStaticRoute("/settings/hosting", "Hosting")

export const settingsAlerts = defineStaticRoute("/settings/alerts", "Alert Settings")

export const settingsWallet = defineStaticRoute("/settings/wallet", "Wallet Settings")

// A page's title is read off its route, which lets the browser tab follow the page.

type PageRoute = {
  pageTitle(params: Record<string, string>, search: URLSearchParams): MaybeAsync<string>
}

// Every page needs a route here, so one added without a title fails the type check.
const pageRoutes: Record<PageId, PageRoute> = {
  [root.id]: root,
  [home.id]: home,
  [bookmarks.id]: bookmarks,
  [join.id]: join,
  [share.id]: share,
  [entity.id]: entity,
  [profile.id]: profile,
  [note.id]: note,
  [messages.id]: messages,
  [conversation.id]: conversation,
  [spaces.id]: spaces,
  [spaceCreate.id]: spaceCreate,
  [space.id]: space,
  [spaceAbout.id]: spaceAbout,
  [spaceAdmin.id]: spaceAdmin,
  [spaceChat.id]: spaceChat,
  [room.id]: room,
  [threads.id]: threads,
  [thread.id]: thread,
  [goals.id]: goals,
  [goal.id]: goal,
  [polls.id]: polls,
  [poll.id]: poll,
  [calendar.id]: calendar,
  [calendarEvent.id]: calendarEvent,
  [classifieds.id]: classifieds,
  [classified.id]: classified,
  [articles.id]: articles,
  [articleCreate.id]: articleCreate,
  [networkArticleCreate.id]: networkArticleCreate,
  [article.id]: article,
  [networkArticle.id]: networkArticle,
  [library.id]: library,
  [board.id]: board,
  [settingsAbout.id]: settingsAbout,
  [settingsProfile.id]: settingsProfile,
  [settingsContent.id]: settingsContent,
  [settingsPrivacy.id]: settingsPrivacy,
  [settingsHosting.id]: settingsHosting,
  [settingsAlerts.id]: settingsAlerts,
  [settingsWallet.id]: settingsWallet,
}

const isPageId = (id: string): id is PageId => Object.hasOwn(pageRoutes, id)

export const getPageTitle = async ({route, params, url}: Page) =>
  route.id && isPageId(route.id) ? pageRoutes[route.id].pageTitle(params, url.searchParams) : ""
