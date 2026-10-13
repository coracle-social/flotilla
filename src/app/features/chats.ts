import {derived, readable} from "svelte/store"
import type {Readable} from "svelte/store"
import {append, identity, on, partition, remove, sort, sortBy, uniq, uniqBy} from "@welshman/lib"
import type {Maybe} from "@welshman/lib"
import {getPow, hexTags, tagValues} from "@welshman/util"
import type {TrustedEvent} from "@welshman/util"
import type {RepositoryUpdate, WrapItem} from "@welshman/net"
import {makeDeriveItem, projection, throttled} from "@welshman/store"
import type {Projection} from "@welshman/store"
import {
  FollowLists,
  Profiles,
  RelayMemberLists,
  RoomLists,
  Wot,
  WotScope,
  createSearch,
} from "@welshman/app"
import type {IApp, Search} from "@welshman/app"
import {app, deriveUserItem, fromApp, user} from "@app/core/app"
import {usePlugin} from "@app/core/plugins"
import {DM_KINDS} from "@app/features/content"
import {userSettingsValues} from "@app/core/settings"

export type Chat = {
  id: string
  pubkeys: string[]
  messages: TrustedEvent[]
  last_activity: number
}

export const getChatPubkeys = (pubkeys: string[]) => sort(uniq(append(user.get().pubkey, pubkeys)))

export const getChatPubkeysFromEvent = (event: TrustedEvent) =>
  getChatPubkeys(tagValues(hexTags("p"), event.tags).concat(event.pubkey))

export const makeChatId = (pubkeys: string[]) => {
  const userPubkey = user.get().pubkey
  const otherPubkeys = remove(userPubkey, uniq(pubkeys))
  const visiblePubkeys = otherPubkeys.length === 0 ? [userPubkey] : otherPubkeys

  return sort(visiblePubkeys).join(",")
}

export const splitChatId = (id: string) => getChatPubkeys(id.split(","))

// Anything else decrypted out of a wrap addressed to the user is a rumor about other people.
export const isUserMessage = (event: TrustedEvent) => {
  const pubkey = user.get().pubkey

  return event.pubkey === pubkey || tagValues(hexTags("p"), event.tags).includes(pubkey)
}

export class Chats {
  private chatsById = new Map<string, Chat>()

  index: Projection<Map<string, Chat>>
  one: (id: string) => Readable<Maybe<Chat>>
  search: Readable<Search<string, Chat>>

  constructor(private readonly app: IApp) {
    this.index = projection(
      readable(this.chatsById, set => {
        this.chatsById.clear()
        this.addEvents(app.repository.query([{kinds: DM_KINDS}]))
        set(this.chatsById)

        return on(app.repository, "update", ({added, removed}: RepositoryUpdate) => {
          const addedChats = this.addEvents(added)
          const removedChats = this.removeEvents(removed)

          if (addedChats || removedChats) {
            set(this.chatsById)
          }
        })
      }),
    )

    this.one = makeDeriveItem(this.index.$)

    // Profiles arrive after the messages that name them, so search text is read when the search is built.
    this.search = derived(
      throttled(1500, derived([this.index.$, app.use(Profiles).index.$], identity)),
      ([$chatsById]) =>
        createSearch(
          sortBy(c => -c.last_activity, Array.from($chatsById.values())),
          {
            getValue: (chat: Chat) => chat.id,
            fuseOptions: {keys: [{name: "search_text", getFn: this.getSearchText}]},
          },
        ),
    )
  }

  private getSearchText = (chat: Chat) => {
    const display = (pubkey: string) => this.app.use(Profiles).display(pubkey).get()

    return chat.pubkeys.length === 1
      ? display(chat.pubkeys[0]) + " note to self"
      : remove(user.get().pubkey, chat.pubkeys).map(display).join(" ")
  }

  private addEvents = (events: TrustedEvent[]) => {
    let dirty = false

    for (const event of events) {
      if (DM_KINDS.includes(event.kind) && isUserMessage(event)) {
        const pubkeys = getChatPubkeysFromEvent(event)
        const id = makeChatId(pubkeys)
        const chat = this.chatsById.get(id)
        const messages = sortBy(
          e => -e.created_at,
          uniqBy(e => e.id, append(event, chat?.messages || [])),
        )
        const last_activity = Math.max(chat?.last_activity || 0, event.created_at)

        this.chatsById.set(id, {id, pubkeys, messages, last_activity})

        dirty = true
      }
    }

    return dirty
  }

  private removeEvents = (removed: Set<string>) => {
    let dirty = false

    // `one` dedupes by reference, so an affected chat is replaced rather than mutated in place.
    for (const [chatId, chat] of this.chatsById) {
      const messages = chat.messages.filter(e => !removed.has(e.id))

      if (messages.length !== chat.messages.length) {
        if (messages.length > 0) {
          this.chatsById.set(chatId, {...chat, messages})
        } else {
          this.chatsById.delete(chatId)
        }

        dirty = true
      }
    }

    return dirty
  }
}

export const chats = usePlugin(Chats)

export const chatSearch = fromApp($app => $app.use(Chats).search)

// Conversations and requests

export enum ChatTab {
  Conversations = "conversations",
  Requests = "requests",
}

export const CHAT_TABS = [
  {value: ChatTab.Conversations, label: "Conversations"},
  {value: ChatTab.Requests, label: "Requests"},
]

// Both thresholds are at least one, since a zero would wave the whole list through.
export type ChatContext = {
  pubkey: string
  follows: Set<string>
  members: Set<string>
  scores: Map<string, number>
  minPow: number
  minWot: number
}

// The wrap manager drops the ciphertext, and proof of work reads off the id and the nonce tag.
const getWrapPow = (wrap: WrapItem) => getPow({...wrap, content: ""})

// The work is on the wrap rather than the rumor, and the best of several is what was paid.
const getMessagePow = (event: TrustedEvent) =>
  Math.max(0, ...app.get().wrapManager.getWraps(event.id).map(getWrapPow))

// Someone the user has a standing relationship with, written to or not.
const isKnown = (pubkey: string, ctx: ChatContext) =>
  ctx.follows.has(pubkey) || ctx.members.has(pubkey) || (ctx.scores.get(pubkey) ?? 0) >= ctx.minWot

// Every other participant has to be known, so a stranger can't get in by adding the user to a group.
export const isConversation = (chat: Chat, ctx: ChatContext) => {
  const others = remove(ctx.pubkey, chat.pubkeys)

  return (
    others.length === 0 ||
    chat.messages.some(event => event.pubkey === ctx.pubkey) ||
    others.every(pubkey => isKnown(pubkey, ctx)) ||
    chat.messages.some(event => getMessagePow(event) >= ctx.minPow)
  )
}

export type ChatsByTab = Record<ChatTab, Chat[]>

export const groupChatsByTab = (chats: Chat[], ctx: ChatContext): ChatsByTab => {
  const [conversations, requests] = partition(chat => isConversation(chat, ctx), chats)

  return {[ChatTab.Conversations]: conversations, [ChatTab.Requests]: requests}
}

const userFollowList = deriveUserItem(FollowLists)

// Read here rather than imported from @app/features/rooms, which already cycles with @app/ui/routes.
const userRoomList = deriveUserItem(RoomLists)

const wotScores = fromApp($app => $app.use(Wot).scores(WotScope.Follows).$)

const relayMembersByUrl = fromApp($app => $app.use(RelayMemberLists).index.$)

export const chatContext = derived(
  [user, userFollowList, wotScores, relayMembersByUrl, userRoomList, userSettingsValues],
  ([$user, $followList, $scores, $membersByUrl, $roomList, $settings]): ChatContext => ({
    pubkey: $user.pubkey,
    follows: new Set($followList?.pubkeys() ?? []),
    members: new Set(
      ($roomList?.urls() ?? []).flatMap(url => $membersByUrl.get(url)?.pubkeys() ?? []),
    ),
    scores: $scores,
    minPow: Math.max(1, $settings.min_dm_pow),
    minWot: Math.max(1, $settings.min_dm_wot),
  }),
)
