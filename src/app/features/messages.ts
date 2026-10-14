import {derived, readable} from "svelte/store"
import type {Readable} from "svelte/store"
import {append, identity, noop, on, partition, remove, sortBy, uniqBy} from "@welshman/lib"
import type {Maybe} from "@welshman/lib"
import {DELETE, REACTION, WRAP, getPow, hexTags, isSignedEvent, tagValues} from "@welshman/util"
import type {EventContent, TrustedEvent} from "@welshman/util"
import type {RepositoryUpdate, WrapItem} from "@welshman/net"
import {makeDeriveItem, projection, synced, throttled, withGetter} from "@welshman/store"
import type {Projection} from "@welshman/store"
import {
  MessagingRelayLists,
  Profiles,
  RelayMemberLists,
  Wot,
  WotScope,
  createSearch,
} from "@welshman/app"
import type {IApp, Search} from "@welshman/app"
import {DM_KINDS} from "@lib/util"
import {app, fromApp} from "@app/core/app"
import {deriveUserItem, user, userFollowList} from "@app/core/user"
import {
  deletes,
  messagingRelayLists,
  reactions,
  relayLists,
  usePlugin,
  wraps,
} from "@app/core/plugins"
import {userSettingsValues} from "@app/core/settings"
import {kv, registerRetention} from "@app/core/storage"
import {makeKeyedSyncs, pullAndListen, registerSync} from "@app/core/sync"
import {userRoomList} from "@app/features/spaces"
import {pushModal} from "@app/navigation/dialogs"
import {lastMessagesUrl} from "@app/navigation/history"
import {navigate} from "@app/navigation/navigate"
import {conversation, getConversationPubkeys, makeConversationId} from "@app/navigation/pages"
import MessagesEnable from "@app/components/MessagesEnable.svelte"

export type Conversation = {
  id: string
  pubkeys: string[]
  messages: TrustedEvent[]
  last_activity: number
}

export const getConversationPubkeysFromEvent = (event: TrustedEvent) =>
  getConversationPubkeys(tagValues(hexTags("p"), event.tags).concat(event.pubkey))

// Anything else decrypted out of a wrap addressed to the user is a rumor about other people.
export const isUserMessage = (event: TrustedEvent) => {
  const pubkey = user.get().pubkey

  return event.pubkey === pubkey || tagValues(hexTags("p"), event.tags).includes(pubkey)
}

export class Messages {
  private conversationsById = new Map<string, Conversation>()

  index: Projection<Map<string, Conversation>>
  one: (id: string) => Readable<Maybe<Conversation>>
  search: Readable<Search<string, Conversation>>

  constructor(private readonly app: IApp) {
    this.index = projection(
      readable(this.conversationsById, set => {
        this.conversationsById.clear()
        this.addEvents(app.repository.query([{kinds: DM_KINDS}]))
        set(this.conversationsById)

        return on(app.repository, "update", ({added, removed}: RepositoryUpdate) => {
          const addedConversations = this.addEvents(added)
          const removedConversations = this.removeEvents(removed)

          if (addedConversations || removedConversations) {
            set(this.conversationsById)
          }
        })
      }),
    )

    this.one = makeDeriveItem(this.index.$)

    // Profiles arrive after the messages that name them, so search text is read when the search is built.
    this.search = derived(
      throttled(1500, derived([this.index.$, app.use(Profiles).index.$], identity)),
      ([$conversationsById]) =>
        createSearch(
          sortBy(c => -c.last_activity, Array.from($conversationsById.values())),
          {
            getValue: (conversation: Conversation) => conversation.id,
            fuseOptions: {keys: [{name: "search_text", getFn: this.getSearchText}]},
          },
        ),
    )
  }

  private getSearchText = (conversation: Conversation) => {
    const display = (pubkey: string) => this.app.use(Profiles).display(pubkey).get()

    return conversation.pubkeys.length === 1
      ? display(conversation.pubkeys[0]) + " note to self"
      : remove(user.get().pubkey, conversation.pubkeys).map(display).join(" ")
  }

  private addEvents = (events: TrustedEvent[]) => {
    let dirty = false

    for (const event of events) {
      if (DM_KINDS.includes(event.kind) && isUserMessage(event)) {
        const pubkeys = getConversationPubkeysFromEvent(event)
        const id = makeConversationId(pubkeys)
        const conversation = this.conversationsById.get(id)
        const messages = sortBy(
          e => -e.created_at,
          uniqBy(e => e.id, append(event, conversation?.messages || [])),
        )
        const last_activity = Math.max(conversation?.last_activity || 0, event.created_at)

        this.conversationsById.set(id, {id, pubkeys, messages, last_activity})

        dirty = true
      }
    }

    return dirty
  }

  private removeEvents = (removed: Set<string>) => {
    let dirty = false

    // `one` dedupes by reference, so an affected conversation is replaced rather than mutated in place.
    for (const [id, conversation] of this.conversationsById) {
      const messages = conversation.messages.filter(e => !removed.has(e.id))

      if (messages.length !== conversation.messages.length) {
        if (messages.length > 0) {
          this.conversationsById.set(id, {...conversation, messages})
        } else {
          this.conversationsById.delete(id)
        }

        dirty = true
      }
    }

    return dirty
  }
}

export const messages = usePlugin(Messages)

export const conversationSearch = fromApp($app => $app.use(Messages).search)

// Conversations and requests

export enum MessagesTab {
  Conversations = "conversations",
  Requests = "requests",
}

export const MESSAGES_TABS = [
  {value: MessagesTab.Conversations, label: "Conversations"},
  {value: MessagesTab.Requests, label: "Requests"},
]

// Both thresholds are at least one, since a zero would wave the whole list through.
export type MessagesContext = {
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
const isKnown = (pubkey: string, ctx: MessagesContext) =>
  ctx.follows.has(pubkey) || ctx.members.has(pubkey) || (ctx.scores.get(pubkey) ?? 0) >= ctx.minWot

// Every other participant has to be known, so a stranger can't get in by adding the user to a group.
export const isAccepted = (conversation: Conversation, ctx: MessagesContext) => {
  const others = remove(ctx.pubkey, conversation.pubkeys)

  return (
    others.length === 0 ||
    conversation.messages.some(event => event.pubkey === ctx.pubkey) ||
    others.every(pubkey => isKnown(pubkey, ctx)) ||
    conversation.messages.some(event => getMessagePow(event) >= ctx.minPow)
  )
}

export type ConversationsByTab = Record<MessagesTab, Conversation[]>

export const groupConversationsByTab = (
  conversations: Conversation[],
  ctx: MessagesContext,
): ConversationsByTab => {
  const [accepted, requests] = partition(
    conversation => isAccepted(conversation, ctx),
    conversations,
  )

  return {[MessagesTab.Conversations]: accepted, [MessagesTab.Requests]: requests}
}

const wotScores = fromApp($app => $app.use(Wot).scores(WotScope.Follows).$)

const relayMembersByUrl = fromApp($app => $app.use(RelayMemberLists).index.$)

export const messagesContext = derived(
  [user, userFollowList, wotScores, relayMembersByUrl, userRoomList, userSettingsValues],
  ([$user, $followList, $scores, $membersByUrl, $roomList, $settings]): MessagesContext => ({
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

// Unwrapping is unconditional, so this is what keeps a signer from decrypting the whole DM history.
export const shouldUnwrap = withGetter(
  synced({
    key: "shouldUnwrap",
    storage: kv,
    defaultValue: false,
  }),
)

const userMessagingRelayList = deriveUserItem(MessagingRelayLists)

const syncMessages = () => {
  const $pubkey = app.get().user?.pubkey

  if ($pubkey) {
    const relaySyncs = makeKeyedSyncs(url => pullAndListen(url, [{kinds: [WRAP], "#p": [$pubkey]}]))

    const syncList = () => {
      if (shouldUnwrap.get()) {
        relaySyncs.reconcile(messagingRelayLists.get().urls($pubkey).get())
      }
    }

    const loadList = async ($shouldUnwrap: boolean) => {
      if ($shouldUnwrap) {
        await relayLists.get().load($pubkey).catch(noop)
        await messagingRelayLists.get().load($pubkey).catch(noop)

        syncList()
      }
    }

    const unsubscribeUnwrap = shouldUnwrap.subscribe(loadList)
    const unsubscribeList = userMessagingRelayList.subscribe(syncList)

    return () => {
      relaySyncs.stop()
      unsubscribeUnwrap()
      unsubscribeList()
    }
  }

  return noop
}

// A conversation's reactions go out gift-wrapped to its members rather than to a relay.
export const publishReaction = async (
  pubkeys: string[],
  event: TrustedEvent,
  {content, tags}: EventContent,
) => {
  const command = await reactions.get().react(event, content, writer => writer.addTags(...tags))

  return wraps.get().publish({event: command.event, recipients: pubkeys, pow: 16})
}

export const retractReaction = async (pubkeys: string[], reaction: TrustedEvent) => {
  const command = await deletes.get().deleteEvent(reaction)

  return wraps.get().publish({event: command.event, recipients: pubkeys, pow: 16})
}

export const registerMessages = () => {
  registerSync(syncMessages)

  // A deletion or reaction inside a gift wrap is unsigned, which is what sets it apart from a public one.
  registerRetention({
    match: event =>
      DM_KINDS.includes(event.kind) ||
      ([DELETE, REACTION].includes(event.kind) && !isSignedEvent(event)),
  })
}

// Messages are read from the user's messaging relays, so they're asked to set some up first.
export const goToMessages = (pubkeys: string[] = [], options: {replaceState?: boolean} = {}) => {
  if (messagingRelayLists.get().urls(user.get().pubkey).get().length === 0) {
    pushModal(MessagesEnable, {next: () => goToMessages(pubkeys, options)})
  } else if (pubkeys.length === 0) {
    navigate(lastMessagesUrl ?? "/chat", options)
  } else {
    navigate(conversation.path({pubkeys}), options)
  }
}
