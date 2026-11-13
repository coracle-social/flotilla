// The replies, reactions, zaps and comments an event collected, held live off the repository.

import {derived, readable} from "svelte/store"
import type {Readable} from "svelte/store"
import {batch, groupBy, on, pushToMapKey, uniq, uniqBy} from "@welshman/lib"
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
  getIdOrAddress,
  getReplyFilters,
  inbox,
  hexTags,
  tagValues,
} from "@welshman/util"
import type {TrustedEvent} from "@welshman/util"
import {Comment} from "@welshman/domain"
import {mergeRepositoryUpdates} from "@welshman/store"
import type {RepositoryUpdate} from "@welshman/store"
import {app} from "@app/core/app"
import {network, router} from "@app/core/plugins"
import {reader} from "@app/core/domain"
import {REACTION_KINDS} from "@app/core/env"

const EVENT_CONTEXT_KINDS = [REPORT, REACTION, ZAP_RECEIPT, COMMENT]

const noEvents: TrustedEvent[] = []

// A NIP-22 comment points at its thread root with `E`/`A`, which is the scope a reply count wants.
const getTargets = (event: TrustedEvent) => {
  if (event.kind === COMMENT) {
    return reader(Comment)(event).root()?.getIdAndAddress() ?? []
  }

  // A direct reply marks its parent as both root and reply, so the same id arrives twice.
  return uniq([...tagValues(hexTags("e"), event.tags), ...tagValues(addressTags("a"), event.tags)])
}

// A space's own relay holds everything about its events, and elsewhere what answers a note goes to its author's inbox.
export const makeEngagementIndex = ({
  relays,
  withReplies = false,
}: {
  relays?: string[]
  withReplies?: boolean
} = {}) => {
  // Kind 1 notes reply with `e` tags rather than as NIP-22 comments.
  const contextKinds = withReplies ? [...EVENT_CONTEXT_KINDS, NOTE] : EVENT_CONTEXT_KINDS
  const requestKinds = withReplies ? [...REACTION_KINDS, NOTE] : REACTION_KINDS
  const {repository} = app.get()
  const controller = new AbortController()
  const targets = new Set<string>()
  const eventsByTarget = new Map<string, TrustedEvent[]>()
  const targetsByEventId = new Map<string, string[]>()
  const subscribersByTarget = new Map<string, Set<(events: TrustedEvent[]) => void>>()
  const deletedChecks = new Map<string, Set<() => void>>()

  const addEvent = (event: TrustedEvent, touched: Set<string>) => {
    // An event seen before its target stays unfiled, so adding the target picks it up from the repository.
    if (!targetsByEventId.has(event.id)) {
      const eventTargets = getTargets(event).filter(target => targets.has(target))

      if (eventTargets.length > 0) {
        targetsByEventId.set(event.id, eventTargets)

        for (const target of eventTargets) {
          eventsByTarget.set(target, [...(eventsByTarget.get(target) || []), event])
          touched.add(target)
        }
      }
    }
  }

  const removeEvent = (id: string, touched: Set<string>) => {
    const eventTargets = targetsByEventId.get(id)

    if (eventTargets) {
      targetsByEventId.delete(id)

      for (const target of eventTargets) {
        const events = eventsByTarget.get(target)!.filter(event => event.id !== id)

        if (events.length > 0) {
          eventsByTarget.set(target, events)
        } else {
          eventsByTarget.delete(target)
        }

        touched.add(target)
      }
    }
  }

  const notifyDeleted = (added: TrustedEvent[], removed: Set<string>) => {
    if (deletedChecks.size > 0) {
      if (removed.size > 0) {
        for (const checks of deletedChecks.values()) {
          for (const check of checks) {
            check()
          }
        }
      } else {
        for (const event of added) {
          for (const check of deletedChecks.get(getIdOrAddress(event)) || []) {
            check()
          }
        }
      }
    }
  }

  const notify = (touched: Set<string>) => {
    for (const target of touched) {
      for (const subscriber of subscribersByTarget.get(target) || []) {
        subscriber(eventsByTarget.get(target) || noEvents)
      }
    }
  }

  const loadFrom = async (urls: string[], events: TrustedEvent[]) => {
    const context = await network.get().load({
      relays: urls,
      signal: controller.signal,
      filters: [
        ...getReplyFilters(events, {kinds: requestKinds}),
        ...getCommentFiltersForRoot(events),
      ],
      timeout: 3000,
    })

    if (context.length > 0) {
      network.get().load({
        relays: urls,
        signal: controller.signal,
        filters: getReplyFilters(context, {kinds: [DELETE]}),
      })
    }
  }

  const loadContext = batch(100, async (events: TrustedEvent[]) => {
    const touched = new Set<string>()

    // Local events never come through the update listener, so file them before asking the network.
    const stored = await repository.query([
      ...getReplyFilters(events, {kinds: contextKinds}),
      ...getCommentFiltersForRoot(events),
    ])

    for (const event of stored) {
      addEvent(event, touched)
    }

    notify(touched)

    const eventsByRelay = new Map<string, TrustedEvent[]>()

    if (relays) {
      for (const url of relays) {
        eventsByRelay.set(url, events)
      }
    } else {
      const byAuthor = groupBy(event => event.pubkey, events)

      await Promise.all(
        Array.from(byAuthor, async ([pubkey, authored]) => {
          const urls = await router.get().resolver.relays([inbox(pubkey)])

          for (const url of urls) {
            for (const event of authored) {
              pushToMapKey(eventsByRelay, url, event)
            }
          }
        }),
      )
    }

    await Promise.all(Array.from(eventsByRelay, ([url, targets]) => loadFrom([url], targets)))
  })

  const unsubscribe = on(
    repository,
    "update",
    batch(150, (updates: RepositoryUpdate[]) => {
      const {added, removed} = mergeRepositoryUpdates(updates)
      const touched = new Set<string>()

      for (const event of added) {
        if (contextKinds.includes(event.kind)) {
          addEvent(event, touched)
        }
      }

      for (const id of removed) {
        removeEvent(id, touched)
      }

      notify(touched)
      notifyDeleted(added, removed)
    }),
  )

  // Track an event so its context gets requested with the rest of the batch
  const add = (event: TrustedEvent) => {
    if (!targets.has(event.id)) {
      for (const key of getIdAndAddress(event)) {
        targets.add(key)
      }

      loadContext(event)
    }
  }

  const relatedForKey = (key: string) =>
    readable(eventsByTarget.get(key) || noEvents, set => {
      let subscribers = subscribersByTarget.get(key)

      if (!subscribers) {
        subscribers = new Set()
        subscribersByTarget.set(key, subscribers)
      }

      subscribers.add(set)
      set(eventsByTarget.get(key) || noEvents)

      return () => {
        subscribers.delete(set)

        if (subscribers.size === 0) {
          subscribersByTarget.delete(key)
        }
      }
    })

  return {
    add,
    deleted: (event: TrustedEvent) =>
      readable(repository.isDeleted(event), set => {
        const key = getIdOrAddress(event)
        const check = () => set(repository.isDeleted(event))

        let checks = deletedChecks.get(key)

        if (!checks) {
          checks = new Set()
          deletedChecks.set(key, checks)
        }

        checks.add(check)
        check()

        return () => {
          checks.delete(check)

          if (checks.size === 0) {
            deletedChecks.delete(key)
          }
        }
      }),
    related: (event: TrustedEvent): Readable<TrustedEvent[]> => {
      add(event)

      // A related event may point at a replaceable one by either id or address, so both are keys.
      const [key, ...rest] = getIdAndAddress(event)

      // A replaceable event collects both buckets, and something tagging it by id and address lands in both.
      return rest.length > 0
        ? derived([relatedForKey(key), ...rest.map(relatedForKey)], buckets =>
            uniqBy(event => event.id, buckets.flat()),
          )
        : relatedForKey(key)
    },
    stop: () => {
      controller.abort()
      unsubscribe()
    },
  }
}

export type EngagementIndex = ReturnType<typeof makeEngagementIndex>
