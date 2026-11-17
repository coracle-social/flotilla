import {derived, readable} from "svelte/store"
import type {Readable} from "svelte/store"
import {batch, groupBy, on, pushToMapKey, removeUndefined, uniq, uniqBy} from "@welshman/lib"
import {
  COMMENT,
  DELETE,
  NOTE,
  REACTION,
  REPORT,
  ZAP_RECEIPT,
  addressTags,
  getCommentFiltersForRoot,
  getIdAndAddress,
  getReplyFilters,
  hexTags,
  inbox,
  tagValues,
} from "@welshman/util"
import type {TrustedEvent} from "@welshman/util"
import {Comment} from "@welshman/domain"
import {mergeRepositoryUpdates} from "@welshman/store"
import type {RepositoryUpdate} from "@welshman/store"
import {app} from "@app/core/app"
import {reader} from "@app/core/domain"
import {REACTION_KINDS} from "@app/core/env"
import {network, router} from "@app/core/plugins"

export type Interactions = {
  track: (event: TrustedEvent) => void
  related: (event: TrustedEvent) => Readable<TrustedEvent[]>
  stop: () => void
}

type Subscriber = (events: TrustedEvent[]) => void

// One shared array, so a key with nothing filed doesn't churn its subscribers.
const EMPTY: TrustedEvent[] = []

const getInteractionKeys = (event: TrustedEvent): string[] => {
  if (event.kind === COMMENT) {
    const comment = reader(Comment)(event)
    const refs = removeUndefined([comment.root(), comment.parent()])

    return uniq(refs.flatMap(ref => ref.getIdAndAddress()))
  }

  // A direct reply names its parent as both root and reply, so the same id arrives twice.
  return uniq([...tagValues(hexTags("e"), event.tags), ...tagValues(addressTags("a"), event.tags)])
}

export const makeInteractions = (
  options: {relays?: string[]; withReplies?: boolean} = {},
): Interactions => {
  const repository = app.get().repository
  const controller = new AbortController()

  const indexKinds = [REPORT, REACTION, ZAP_RECEIPT, COMMENT]
  const requestKinds = [...REACTION_KINDS]

  if (options.withReplies) {
    indexKinds.push(NOTE)
    requestKinds.push(NOTE)
  }

  const index = new Map<string, TrustedEvent[]>()
  const keysById = new Map<string, string[]>()
  const subscribers = new Map<string, Set<Subscriber>>()
  const tracked = new Set<string>()

  const file = (event: TrustedEvent) => {
    const filed = keysById.get(event.id) ?? []
    // A key tracked after this was filed still takes it, from the repository read in fileStored.
    const keys = getInteractionKeys(event).filter(key => tracked.has(key) && !filed.includes(key))

    if (keys.length) {
      for (const key of keys) {
        pushToMapKey(index, key, event)
      }

      keysById.set(event.id, [...filed, ...keys])
    }

    return keys
  }

  const unfile = (id: string) => {
    const keys = keysById.get(id) ?? []

    for (const key of keys) {
      const remaining = (index.get(key) ?? []).filter(event => event.id !== id)

      if (remaining.length) {
        index.set(key, remaining)
      } else {
        index.delete(key)
      }
    }

    keysById.delete(id)

    return keys
  }

  const notify = (keys: Iterable<string>) => {
    for (const key of keys) {
      const subscribersForKey = subscribers.get(key)

      if (subscribersForKey) {
        const events = index.get(key) ?? EMPTY

        for (const subscriber of subscribersForKey) {
          subscriber(events)
        }
      }
    }
  }

  const fileStored = async (events: TrustedEvent[]) => {
    const filters = [
      ...getReplyFilters(events, {kinds: indexKinds}),
      ...getCommentFiltersForRoot(events),
    ]

    // Local events never come through the update listener, so notify as we file them.
    notify((await repository.query(filters)).flatMap(file))
  }

  const loadInteractions = batch(100, async (events: TrustedEvent[]) => {
    await fileStored(events)

    const eventsByRelay = new Map<string, TrustedEvent[]>()

    if (options.relays) {
      for (const url of options.relays) {
        eventsByRelay.set(url, events)
      }
    } else {
      const byAuthor = groupBy((event: TrustedEvent) => event.pubkey, events)
      const inboxes = await Promise.all(
        Array.from(byAuthor, async ([pubkey, authorEvents]) => ({
          relays: await router.get().resolver.relays([inbox(pubkey)]),
          events: authorEvents,
        })),
      )

      for (const {relays, events} of inboxes) {
        for (const url of relays) {
          for (const event of events) {
            pushToMapKey(eventsByRelay, url, event)
          }
        }
      }
    }

    await Promise.all(
      Array.from(eventsByRelay, async ([url, relayEvents]) => {
        const found = await network.get().load({
          relays: [url],
          signal: controller.signal,
          timeout: 3000,
          filters: [
            ...getReplyFilters(relayEvents, {kinds: requestKinds}),
            ...getCommentFiltersForRoot(relayEvents),
          ],
        })

        if (found.length) {
          network.get().load({
            relays: [url],
            signal: controller.signal,
            filters: getReplyFilters(found, {kinds: [DELETE]}),
          })
        }
      }),
    )
  })

  const track = (event: TrustedEvent) => {
    if (!tracked.has(event.id)) {
      for (const key of getIdAndAddress(event)) {
        tracked.add(key)
      }

      loadInteractions(event)
    }
  }

  const relatedForKey = (key: string): Readable<TrustedEvent[]> =>
    readable<TrustedEvent[]>(EMPTY, set => {
      const subscribersForKey = subscribers.get(key) ?? new Set<Subscriber>()

      subscribers.set(key, subscribersForKey)
      subscribersForKey.add(set)
      set(index.get(key) ?? EMPTY)

      return () => {
        subscribersForKey.delete(set)

        if (!subscribersForKey.size) {
          subscribers.delete(key)
        }
      }
    })

  const related = (event: TrustedEvent): Readable<TrustedEvent[]> => {
    track(event)

    const perKey = getIdAndAddress(event).map(relatedForKey)

    if (perKey.length === 1) {
      return perKey[0]
    }

    return derived(perKey, events => uniqBy(e => e.id, events.flat()))
  }

  const off = on(
    repository,
    "update",
    batch(150, (updates: RepositoryUpdate[]) => {
      const {added, removed} = mergeRepositoryUpdates(updates)
      const touched = new Set<string>()

      for (const event of added) {
        if (indexKinds.includes(event.kind)) {
          for (const key of file(event)) {
            touched.add(key)
          }
        }
      }

      for (const id of removed) {
        for (const key of unfile(id)) {
          touched.add(key)
        }
      }

      notify(touched)
    }),
  )

  const stop = () => {
    controller.abort()
    off()
  }

  return {track, related, stop}
}
