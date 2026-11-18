<script lang="ts">
  import type {Placement} from "tippy.js"
  import type {TrustedEvent, EventContent} from "@welshman/util"
  import ReactionSummary from "@app/components/ReactionSummary.svelte"
  import {publishReaction, retractReaction} from "@app/tools/interactions/reactions"
  import * as spaces from "@app/areas/spaces"

  type Props = {
    event: TrustedEvent
    url?: string
    placement?: Placement
    emojiMenu?: boolean
  }

  const {event, url, placement = "top", emojiMenu = false}: Props = $props()

  const deleteReaction = (reaction: TrustedEvent) =>
    url ? spaces.retractReaction(url, reaction) : retractReaction(reaction)

  const createReaction = (values: EventContent) =>
    url ? spaces.publishReaction(url, event, values) : publishReaction(event, values)
</script>

<ReactionSummary {url} {event} {deleteReaction} {createReaction} {placement} {emojiMenu} />
