import {derived, readable} from "svelte/store"
import {append, call, on, remove, sort, sortBy, uniq, uniqBy} from "@welshman/lib"
import type {Override} from "@welshman/lib"
import {DELETE, PROFILE, hexTags, tagValues} from "@welshman/util"
import type {TrustedEvent} from "@welshman/util"
import type {RepositoryUpdate} from "@welshman/net"
import {makeDeriveItem, throttled} from "@welshman/store"
import {createSearch} from "@welshman/app"
import type {App} from "@welshman/app"
import {app, profiles, user} from "@app/core"
import {DM_KINDS} from "@app/content"

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
        if (DM_KINDS.includes(event.kind)) {
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
