import {readable} from "svelte/store"
import {first} from "@welshman/lib"
import type {Maybe} from "@welshman/lib"
import {EventRef} from "@welshman/util"
import type {IEventRef, TrustedEvent} from "@welshman/util"
import {Events, Network, Router} from "@welshman/app"
import type {IApp} from "@welshman/app"
import {usePlugin} from "@app/core/plugins"
import {buildCommentTree, getDescendants, getThreadFilters} from "@app/features/social/replies"
import type {CommentNode} from "@app/features/social/replies"

// Where a note lives, and the stores a page reads it and its conversation from.
export class Notes {
  constructor(private readonly app: IApp) {}

  relays = (ref: IEventRef) =>
    this.app.use(Router).resolver.relays(new EventRef(ref).getRelaySelections())

  load = async (ref: IEventRef) => {
    const eventRef = new EventRef(ref)
    const idOrAddress = eventRef.getIdOrAddress()

    if (idOrAddress) {
      return (
        this.app.repository.getEvent(idOrAddress) ??
        first(
          await this.app.use(Network).load({
            relays: await this.relays(ref),
            filters: eventRef.getFilters(),
            timeout: 3000,
          }),
        )
      )
    }
  }

  // A pointer carrying no hints would never resolve, so the load beside it asks the author's relays.
  deriveEvent = (ref: IEventRef) => {
    const idOrAddress = new EventRef(ref).getIdOrAddress()

    this.load(ref)

    return idOrAddress
      ? this.app.use(Events).one(idOrAddress, ref.relays ?? []).$
      : readable<Maybe<TrustedEvent>>(undefined)
  }

  // The filters reach past direct replies, so the tree is built from what hangs off the note.
  deriveReplies = (event: TrustedEvent) =>
    readable<CommentNode[]>([], set => {
      const filters = getThreadFilters(event)
      const controller = new AbortController()

      this.relays(event).then(relays =>
        this.app.use(Network).request({relays, filters, signal: controller.signal}),
      )

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
