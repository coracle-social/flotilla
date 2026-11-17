import {derived, readable, writable} from "svelte/store"
import {first, removeUndefined, spec, uniq} from "@welshman/lib"
import type {Maybe} from "@welshman/lib"
import {EventRef, getIdAndAddress, getIdFilters, hexTags, outbox, tagValues} from "@welshman/util"
import type {IEventRef, TrustedEvent} from "@welshman/util"
import {Events, Network, Router} from "@welshman/app"
import type {IApp} from "@welshman/app"
import {usePlugin} from "@app/core/plugins"
import {getThreadRefs} from "@app/features/interactions/targets"
import {buildCommentTree, getDescendants, getThreadFilters} from "@app/features/notes/threads"
import type {CommentNode} from "@app/features/notes/threads"

/** A note to load, with the replies whose p tags name its author when its ref doesn't. */
export type NoteRequest = {ref: EventRef; replies?: TrustedEvent[]}

/** Loads notes, the thread above a reply and the comments under a note from where they live. */
export class Notes {
  constructor(private readonly app: IApp) {}

  /** The relays a note lives on, from its ref and from the authors its replies tag. */
  relays = (ref: IEventRef, replies: TrustedEvent[] = []) => {
    // A reply's e tag can name neither author nor relay, but NIP-10 has the reply p-tag the author.
    const pubkeys = replies.flatMap(reply => tagValues(hexTags("p"), reply.tags))

    return this.app
      .use(Router)
      .resolver.relays([
        ...new EventRef(ref).getRelaySelections(),
        ...pubkeys.map(pubkey => outbox(pubkey)),
      ])
  }

  /** One note, from the repository when it holds it and from the relays it lives on otherwise. */
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

  /** Many notes at once, filed by id and address; relays are asked only for what's missing. */
  loadMany = async (
    requests: NoteRequest[],
    {
      signal,
      timeout = 3000,
      priority,
    }: {signal?: AbortSignal; timeout?: number; priority?: number} = {},
  ): Promise<Map<string, TrustedEvent>> => {
    const events = new Map<string, TrustedEvent>()

    const file = (event: TrustedEvent) => {
      for (const key of getIdAndAddress(event)) {
        events.set(key, event)
      }
    }

    const keys = uniq(removeUndefined(requests.map(({ref}) => ref.getAddressOrId())))

    if (keys.length === 0) {
      return events
    }

    for (const event of await this.app.repository.query(getIdFilters(keys))) {
      file(event)
    }

    const missing = requests.filter(({ref}) => {
      const key = ref.getAddressOrId()

      return !key || !events.has(key)
    })

    if (missing.length > 0) {
      const selections = await Promise.all(
        missing.map(({ref, replies}) => this.relays(ref, replies)),
      )

      const loaded = await this.app.use(Network).load({
        relays: uniq(selections.flat()),
        filters: getIdFilters(removeUndefined(missing.map(({ref}) => ref.getAddressOrId()))),
        timeout,
        priority,
        signal,
      })

      for (const event of loaded) {
        file(event)
      }
    }

    return events
  }

  /** A store of the note a ref names, read live from the repository and loaded if missing. */
  deriveEvent = (ref: IEventRef) => {
    const idOrAddress = new EventRef(ref).getIdOrAddress()
    const loaded = writable<Maybe<TrustedEvent>>(undefined)

    // A pointer with no hints would never resolve, so the load beside it asks the author's relays.
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

  /** The thread above a reply: its root, and each parent up to it, reported as each one arrives. */
  loadThread = async (
    event: TrustedEvent,
    onLoad?: (thread: {threadRoot?: TrustedEvent; parents: TrustedEvent[]}) => void,
  ) => {
    const parents: TrustedEvent[] = []
    let threadRoot: TrustedEvent | undefined

    // Each hop is reported as it arrives, so a deep thread fills in from the top.
    const report = () => onLoad?.({threadRoot, parents: [...parents]})

    // A reply names only the event it answers, so the thread is walked up one hop at a time.
    const walk = async (child: TrustedEvent) => {
      const {parent} = getThreadRefs(child)

      if (parent) {
        const ancestor = await this.load(parent, {replies: [child]})

        if (ancestor && !parents.some(spec({id: ancestor.id}))) {
          parents.unshift(ancestor)
          report()

          await walk(ancestor)
        }
      }
    }

    const {parent, root} = getThreadRefs(event)

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

  /** A store of the comment tree under a note, kept current as comments arrive from its relays. */
  deriveReplies = (event: TrustedEvent) =>
    readable<CommentNode[]>([], set => {
      // The filters reach past direct replies, so the tree is built from what hangs off the note.
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

/** A store of the current app's `Notes` plugin. */
export const notes = usePlugin(Notes)
