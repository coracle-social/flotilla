import {readable} from "svelte/store"
import type {Unsubscriber} from "svelte/store"
import {first, on} from "@welshman/lib"
import type {Maybe} from "@welshman/lib"
import {sortEventsDesc} from "@welshman/util"
import type {Filter, TrustedEvent} from "@welshman/util"
import * as store from "@welshman/store"
import {Network} from "@welshman/app"
import {app, fromApp} from "@app/core"

// Events

export const deriveEvent = (idOrAddress: string, relays: string[] = []) =>
  fromApp($app =>
    store.makeDeriveEvent({
      repository: $app.repository,
      includeDeleted: true,
      onDerive: (filters: Filter[], hints: string[]) =>
        $app.use(Network).loadLenient({filters, relays: hints}),
    })(idOrAddress, relays),
  )

export const deriveEventsById = (filters: Filter[] = [{}]) =>
  fromApp($app => store.deriveEventsById({repository: $app.repository, filters}))

export const deriveEvents = (filters: Filter[] = [{}]) =>
  store.deriveEventsDesc(deriveEventsById(filters))

export const deriveIsDeleted = (event: TrustedEvent) =>
  fromApp($app => store.deriveIsDeleted($app.repository, event))

// Events on a relay

export const getEventsForUrl = (url: string, filters: Filter[] = [{}]) =>
  store
    .getEventsByIdForUrl({
      url,
      filters,
      tracker: app.get().tracker,
      repository: app.get().repository,
    })
    .values()

export const deriveEventsByIdForUrl = (url: string, filters: Filter[] = [{}]) =>
  fromApp($app =>
    store.deriveEventsByIdForUrl({
      url,
      filters,
      tracker: $app.tracker,
      repository: $app.repository,
    }),
  )

export const deriveEventsForUrl = (url: string, filters: Filter[] = [{}]) =>
  store.deriveArray(deriveEventsByIdForUrl(url, filters))

export const deriveEventsByIdByUrl = (filters: Filter[] = [{}]) =>
  fromApp($app =>
    store.deriveEventsByIdByUrl({filters, tracker: $app.tracker, repository: $app.repository}),
  )

// The most recent event held from one author.

const latestByPubkey = new Map<string, Maybe<TrustedEvent>>()

const latestSubscribers = new Map<string, Set<(event: Maybe<TrustedEvent>) => void>>()

let latestUnsubscriber: Maybe<Unsubscriber>

const readLatest = (pubkey: string) =>
  first(sortEventsDesc(app.get().repository.query([{authors: [pubkey]}])))

export const deriveLatestEvent = (pubkey: string) =>
  readable<Maybe<TrustedEvent>>(undefined, set => {
    let subscribers = latestSubscribers.get(pubkey)

    if (!subscribers) {
      subscribers = new Set()
      latestSubscribers.set(pubkey, subscribers)
      latestByPubkey.set(pubkey, readLatest(pubkey))
    }

    subscribers.add(set)
    set(latestByPubkey.get(pubkey))

    latestUnsubscriber ??= on(app.get().repository, "update", ({added, removed}) => {
      const touched = new Set<string>()

      for (const event of added) {
        if (latestSubscribers.has(event.pubkey)) {
          const current = latestByPubkey.get(event.pubkey)

          if (!current || event.created_at > current.created_at) {
            latestByPubkey.set(event.pubkey, event)
            touched.add(event.pubkey)
          }
        }
      }

      // A removal can take the very event a row is showing, so that author has to be looked up
      // again rather than just dropped
      for (const [author, event] of latestByPubkey) {
        if (event && removed.has(event.id)) {
          latestByPubkey.set(author, readLatest(author))
          touched.add(author)
        }
      }

      for (const author of touched) {
        for (const subscriber of latestSubscribers.get(author) || []) {
          subscriber(latestByPubkey.get(author))
        }
      }
    })

    return () => {
      subscribers.delete(set)

      if (subscribers.size === 0) {
        latestSubscribers.delete(pubkey)
        latestByPubkey.delete(pubkey)

        if (latestSubscribers.size === 0) {
          latestUnsubscriber?.()
          latestUnsubscriber = undefined
        }
      }
    }
  })
