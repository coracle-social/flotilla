<script lang="ts">
  import type {Placement} from "tippy.js"
  import type {TrustedEvent, EventContent} from "@welshman/util"
  import ReactionSummary from "@app/components/ReactionSummary.svelte"
  import {publishReaction, retractReaction} from "@app/features/interactions"
  import type {Interactions} from "@app/features/interactions"
  import * as spaces from "@app/features/spaces"

  type Props = {
    event: TrustedEvent
    interactions: Interactions
    url?: string
    placement?: Placement
    emojiMenu?: boolean
  }

  const {event, interactions, url, placement = "top", emojiMenu = false}: Props = $props()

  const deleteReaction = (reaction: TrustedEvent) =>
    url ? spaces.retractReaction(url, reaction) : retractReaction(reaction)

  const createReaction = (values: EventContent) =>
    url ? spaces.publishReaction(url, event, values) : publishReaction(event, values)
</script>

<ReactionSummary
  {url}
  {event}
  {interactions}
  {deleteReaction}
  {createReaction}
  {placement}
  {emojiMenu} />
