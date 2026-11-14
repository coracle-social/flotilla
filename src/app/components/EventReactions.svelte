<script lang="ts">
  import type {Placement} from "tippy.js"
  import type {TrustedEvent, EventContent} from "@welshman/util"
  import ReactionSummary from "@app/components/ReactionSummary.svelte"
  import * as social from "@app/features/social"
  import * as spaces from "@app/features/spaces"
  import type {Engagement} from "@app/features/engagement"

  type Props = {
    event: TrustedEvent
    engagement: Engagement
    url?: string
    placement?: Placement
    emojiMenu?: boolean
  }

  const {event, engagement, url, placement = "top", emojiMenu = false}: Props = $props()

  const deleteReaction = (reaction: TrustedEvent) =>
    url ? spaces.retractReaction(url, reaction) : social.retractReaction(reaction)

  const createReaction = (values: EventContent) =>
    url ? spaces.publishReaction(url, event, values) : social.publishReaction(event, values)
</script>

<ReactionSummary
  {url}
  {event}
  {engagement}
  {deleteReaction}
  {createReaction}
  {placement}
  {emojiMenu} />
