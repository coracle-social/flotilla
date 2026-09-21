import {derived, readable} from "svelte/store"
import {append, call, on, partition, remove, sort, sortBy, uniq, uniqBy} from "@welshman/lib"
import type {Override} from "@welshman/lib"
import {DELETE, PROFILE, getPow, hexTags, tagValues} from "@welshman/util"
import type {TrustedEvent} from "@welshman/util"
import type {RepositoryUpdate, WrapItem} from "@welshman/net"
import {makeDeriveItem, throttled} from "@welshman/store"
import {FollowLists, RelayMemberLists, RoomLists, Wot, WotScope, createSearch} from "@welshman/app"
import type {App} from "@welshman/app"
import {app, deriveUserItem, fromApp, profiles, user} from "@app/core"
import {DM_KINDS} from "@app/content"
import {userSettingsValues} from "@app/settings"

export type Chat = {
  id: string
  pubkeys: string[]
  messages: TrustedEvent[]
  last_activity: number
  search_text: string
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

// A message the user is party to: they wrote it, or it names them. Anything else decrypted out of
// a wrap addressed to them is a rumor about other people, which is either a mistake or an attempt
// to plant a conversation in their list.
export const isUserMessage = (event: TrustedEvent) => {
  const pubkey = user.get().pubkey

  return event.pubkey === pubkey || tagValues(hexTags("p"), event.tags).includes(pubkey)
}

export const chatsById = call(() => {
  const chatsById = new Map<string, Chat>()
  const chatsByPubkey = new Map<string, string[]>()

  const displayProfile = (pubkey: string) => profiles.get().display(pubkey).get()

  const addSearchText = (chat: Override<Chat, {search_text?: string}>) => {
    chat.search_text =
      chat.pubkeys.length === 1
        ? displayProfile(chat.pubkeys[0]) + " note to self"
        : remove(user.get().pubkey, chat.pubkeys).map(displayProfile).join(" ")

    return chat as Chat
  }

  return readable(chatsById, set => {
    const indexChatByPubkeys = (chat: Chat) => {
      for (const pubkey of chat.pubkeys) {
        chatsByPubkey.set(pubkey, uniq(append(chat.id, chatsByPubkey.get(pubkey) || [])))
      }
    }

    const addEvents = (events: TrustedEvent[]) => {
      let dirty = false
      for (const event of events) {
        if (DM_KINDS.includes(event.kind) && isUserMessage(event)) {
          const pubkeys = getChatPubkeysFromEvent(event)
          const id = makeChatId(pubkeys)
          const chat = chatsById.get(id)
          const messages = sortBy(
            e => -e.created_at,
            uniqBy(e => e.id, append(event, chat?.messages || [])),
          )
          const last_activity = Math.max(chat?.last_activity || 0, event.created_at)
          const updatedChat = addSearchText({id, pubkeys, messages, last_activity})

          chatsById.set(id, updatedChat)
          indexChatByPubkeys(updatedChat)

          dirty = true
        }

        if (event.kind === PROFILE) {
          for (const chatId of chatsByPubkey.get(event.pubkey) || []) {
            const chat = chatsById.get(chatId)

            if (chat) {
              addSearchText(chat)
              dirty = true
            }
          }
        }
      }

      if (dirty) {
        set(chatsById)
      }
    }

    const removeEvents = (removed: Set<string>) => {
      let dirty = false

      // Drop the removed ids from whatever chats hold them, matching on id alone. A removed event
      // can't be looked up in the repository — a cancelled delayed send is dropped from it outright
      // (unlike a delete, which leaves the target flagged), so `getEvent` would return nothing and
      // the message would linger. Replace each affected chat with a fresh object rather than mutating
      // its messages in place: deriveChat is deduplicated by reference (see makeDeriveItem/
      // deriveDeduplicated), so a chat whose identity is unchanged never reaches the ui. A chat
      // that loses its last message goes with it, since a chat is only ever its messages.
      for (const [chatId, chat] of chatsById) {
        const messages = chat.messages.filter(e => !removed.has(e.id))

        if (messages.length !== chat.messages.length) {
          if (messages.length > 0) {
            chatsById.set(chatId, {...chat, messages})
          } else {
            chatsById.delete(chatId)
          }

          dirty = true
        }
      }

      if (dirty) {
        set(chatsById)
      }
    }

    // Login swaps the whole app — a new identity gets a new repository — so a listener bound to
    // `app.get().repository` once at start would keep reading the discarded one after login (see the
    // note on `fromApp` in core.ts). Re-bind through the `app` store instead: on each app, rebuild
    // the list from that repository and listen to it, tearing down the previous binding first.
    let repoUnsubscribe: (() => void) | undefined

    const bindRepository = ($app: App) => {
      repoUnsubscribe?.()

      chatsById.clear()
      chatsByPubkey.clear()
      addEvents($app.repository.query([{kinds: [...DM_KINDS, DELETE, PROFILE]}]))
      set(chatsById)

      repoUnsubscribe = on($app.repository, "update", ({added, removed}: RepositoryUpdate) => {
        // Do this async so that profiles are populated
        setTimeout(() => {
          addEvents(added)
          removeEvents(removed)
        }, 200)
      })
    }

    const unsubscribeApp = app.subscribe(bindRepository)

    return () => {
      repoUnsubscribe?.()
      unsubscribeApp()
    }
  })
})

export const deriveChat = makeDeriveItem(chatsById)

export const chatSearch = derived(throttled(1500, chatsById), $chatsByPubkey => {
  return createSearch(
    sortBy(c => -c.last_activity, Array.from($chatsByPubkey.values())),
    {
      getValue: (chat: Chat) => chat.id,
      fuseOptions: {keys: ["search_text"]},
    },
  )
})

// Conversations and requests

export enum ChatTab {
  Conversations = "conversations",
  Requests = "requests",
}

export const CHAT_TABS = [
  {value: ChatTab.Conversations, label: "Conversations"},
  {value: ChatTab.Requests, label: "Requests"},
]

// Both thresholds are at least one: a pubkey nobody vouches for and a message carrying no nonce
// have met nothing, so a zero would wave the whole list through.
export type ChatContext = {
  pubkey: string
  follows: Set<string>
  members: Set<string>
  scores: Map<string, number>
  minPow: number
  minWot: number
}

// The wrap manager keeps everything about a wrap but its ciphertext, and proof of work is read off
// the id and the nonce tag, so an empty content stands in for what it dropped.
const getWrapPow = (wrap: WrapItem) => getPow({...wrap, content: ""})

// A gift wrap is the event a sender has to mint, so the work is on it rather than on the rumor
// sealed inside. A message can arrive in more than one wrap; the best of them is what was paid.
const getMessagePow = (event: TrustedEvent) =>
  Math.max(0, ...app.get().wrapManager.getWraps(event.id).map(getWrapPow))

// Someone the user has a standing relationship with, whether or not they have ever written to
// each other.
const isKnown = (pubkey: string, ctx: ChatContext) =>
  ctx.follows.has(pubkey) || ctx.members.has(pubkey) || (ctx.scores.get(pubkey) ?? 0) >= ctx.minWot

// A chat the user asked for rather than one that arrived: they have written in it, they know
// everyone else in it, or somebody spent proof of work to reach them. Every other participant has
// to be known, so a stranger cannot get in by adding the user to a group with their friends.
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

// The spaces the user belongs to, read here rather than imported from @app/rooms: that module
// and @app/routes already require each other, and joining the cycle leaves this one holding an
// uninitialized binding.
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
