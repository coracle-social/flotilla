import {derived, readable, writable} from "svelte/store"
import {first, spec} from "@welshman/lib"
import type {Maybe} from "@welshman/lib"
import {EventRef, hexTags, outbox, tagValues} from "@welshman/util"
import type {IEventRef, TrustedEvent} from "@welshman/util"
import {Events, Network, Router} from "@welshman/app"
import type {IApp} from "@welshman/app"
import {usePlugin} from "@app/core/plugins"
import {
  buildCommentTree,
  getDescendants,
  getReplyRefs,
  getThreadFilters,
} from "@app/features/social/replies"
import type {CommentNode} from "@app/features/social/replies"

// Where a note lives, and the stores a page reads it and its conversation from.
export class Notes {
  constructor(private readonly app: IApp) {}

  // A reply's e tag can name neither author nor relay, but NIP-10 has the reply p-tag the author.
  relays = (ref: IEventRef, replies: TrustedEvent[] = []) => {
    const pubkeys = replies.flatMap(reply => tagValues(hexTags("p"), reply.tags))

    return this.app
      .use(Router)
      .resolver.relays([
        ...new EventRef(ref).getRelaySelections(),
        ...pubkeys.map(pubkey => outbox(pubkey)),
      ])
  }

  load = async (
    ref: IEventRef,
    {
      replies = [],
      priority,
      signal,
      timeout = 3000,
    }: {replies?: TrustedEvent[]; priority?: number; signal?: AbortSignal; timeout?: number} = {},
  ) => {
    const eventRef = new EventRef(ref)
    const idOrAddress = eventRef.getIdOrAddress()

    if (idOrAddress) {
      const event = await this.app.repository.getEvent(idOrAddress)

      return (
        event ??
        first(
          await this.app.use(Network).load({
            relays: await this.relays(ref, replies),
            filters: eventRef.getFilters(),
            timeout,
            priority,
            signal,
          }),
        )
      )
    }
  }

  // A pointer carrying no hints would never resolve, so the load beside it asks the author's relays.
  deriveEvent = (ref: IEventRef) => {
    const idOrAddress = new EventRef(ref).getIdOrAddress()
    const loaded = writable<Maybe<TrustedEvent>>(undefined)

    this.load(ref)
      .then(event => loaded.set(event))
      .catch(error => console.error(error))

    if (!idOrAddress) {
      return loaded
    }

    const events = this.app.use(Events).one(idOrAddress, ref.relays ?? []).$

    // The observe drops what a plain read still serves, so the load's answer stands in behind it.
    return derived(
      [events, loaded],
      ([$event, $loaded]: Maybe<TrustedEvent>[]) => $event ?? $loaded,
    )
  }

  resolveRelays = (event: TrustedEvent) =>
    Array.from(this.app.repository.tracker.getRelays(event.id))

  // A reply names only the event it answers, so the thread is walked up one hop at a time.
  loadThread = async (
    event: TrustedEvent,
    onLoad?: (thread: {threadRoot?: TrustedEvent; parents: TrustedEvent[]}) => void,
  ) => {
    const parents: TrustedEvent[] = []
    let threadRoot: TrustedEvent | undefined

    // Each hop is reported as it arrives, so a deep thread fills in from the top.
    const report = () => onLoad?.({threadRoot, parents: [...parents]})

    const walk = async (child: TrustedEvent) => {
      const {parent} = getReplyRefs(child)

      if (parent) {
        const ancestor = await this.load(parent, {replies: [child]})

        if (ancestor && !parents.some(spec({id: ancestor.id}))) {
          parents.unshift(ancestor)
          report()

          await walk(ancestor)
        }
      }
    }

    const {parent, root} = getReplyRefs(event)

    const rootLoad =
      root && root.getIdOrAddress() !== parent?.getIdOrAddress()
        ? this.load(root, {replies: [event]}).then(loaded => {
            threadRoot = loaded
            report()
          })
        : undefined

    await Promise.all([walk(event), rootLoad])

    return {threadRoot, parents}
  }

  // The filters reach past direct replies, so the tree is built from what hangs off the note.
  deriveReplies = (event: TrustedEvent) =>
    readable<CommentNode[]>([], set => {
      const filters = getThreadFilters(event)
      const controller = new AbortController()

      this.relays(event)
        .then(relays => this.app.use(Network).request({relays, filters, signal: controller.signal}))
        .catch(error => console.error(error))

      const unsubscribe = this.app
        .use(Events)
        .asc(filters)
        .$.subscribe($events => set(buildCommentTree(event, getDescendants(event, $events))))

      return () => {
        controller.abort()
        unsubscribe()
      }
    })
}

export const notes = usePlugin(Notes)
