import type {EventContent, TrustedEvent} from "@welshman/util"
import {publish} from "@welshman/app"
import {deletes, reactions} from "@app/core/plugins"

export const publishReaction = (event: TrustedEvent, {content, tags}: EventContent) =>
  reactions
    .get()
    .react(event, content, writer => writer.addTags(...tags))
    .then(publish)

export const retractReaction = (reaction: TrustedEvent) =>
  deletes.get().deleteEvent(reaction).then(publish)
