import {readable} from "svelte/store"
import type {Unsubscriber} from "svelte/store"
import {first, on} from "@welshman/lib"
import type {Maybe} from "@welshman/lib"
import {sortEventsDesc} from "@welshman/util"
import type {TrustedEvent} from "@welshman/util"
import type {RepositoryUpdate} from "@welshman/net"
import type {IApp} from "@welshman/app"
import {usePlugin} from "@app/core"

// The most recent event held from each watched author, sharing one repository listener across them.
export class LatestEvents {
  private latestByPubkey = new Map<string, Maybe<TrustedEvent>>()
  private subscribers = new Map<string, Set<(event: Maybe<TrustedEvent>) => void>>()
  private unsubscriber: Maybe<Unsubscriber>

  constructor(private readonly app: IApp) {}

  private read = (pubkey: string) =>
    first(sortEventsDesc(this.app.repository.query([{authors: [pubkey]}])))

  private onUpdate = ({added, removed}: RepositoryUpdate) => {
    const touched = new Set<string>()

    for (const event of added) {
      if (this.subscribers.has(event.pubkey)) {
        const current = this.latestByPubkey.get(event.pubkey)

        if (!current || event.created_at > current.created_at) {
          this.latestByPubkey.set(event.pubkey, event)
          touched.add(event.pubkey)
        }
      }
    }

    // A removal can take the very event a row is showing, so that author is looked up again.
    for (const [author, event] of this.latestByPubkey) {
      if (event && removed.has(event.id)) {
        this.latestByPubkey.set(author, this.read(author))
        touched.add(author)
      }
    }

    for (const author of touched) {
      for (const subscriber of this.subscribers.get(author) || []) {
        subscriber(this.latestByPubkey.get(author))
      }
    }
  }

  forPubkey = (pubkey: string) =>
    readable<Maybe<TrustedEvent>>(undefined, set => {
      let subscribers = this.subscribers.get(pubkey)

      if (!subscribers) {
        subscribers = new Set()
        this.subscribers.set(pubkey, subscribers)
        this.latestByPubkey.set(pubkey, this.read(pubkey))
      }

      subscribers.add(set)
      set(this.latestByPubkey.get(pubkey))

      this.unsubscriber ??= on(this.app.repository, "update", this.onUpdate)

      return () => {
        subscribers.delete(set)

        if (subscribers.size === 0) {
          this.subscribers.delete(pubkey)
          this.latestByPubkey.delete(pubkey)

          if (this.subscribers.size === 0) {
            this.unsubscriber?.()
            this.unsubscriber = undefined
          }
        }
      }
    })
}

export const latestEvents = usePlugin(LatestEvents)
