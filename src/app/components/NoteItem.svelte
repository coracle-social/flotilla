<script lang="ts">
  import type {Snippet} from "svelte"
  import type {TrustedEvent} from "@welshman/util"
  import NoteContent from "@app/components/NoteContent.svelte"
  import NoteCard from "@app/components/NoteCard.svelte"
  import EventReactions from "@app/components/EventReactions.svelte"
  import Cv from "@lib/components/Cv.svelte"
  import type {FeedContext} from "@app/feeds"

  type Props = {
    event: TrustedEvent
    children?: Snippet
    context: FeedContext
    url?: string
    card?: boolean
    interactive?: boolean
    showEntire?: boolean
  }

  const {
    url,
    event,
    children,
    context,
    card = true,
    interactive = card,
    showEntire = false,
  }: Props = $props()
</script>

{#snippet body()}
  <NoteContent {event} {showEntire} expandMode="inline" />
  <div class="flex w-full justify-between gap-2">
    <EventReactions {event} {context} {url} reactionClass="tip-right" />
    {@render children?.()}
  </div>
{/snippet}

{#if card}
  <Cv tag={NoteCard} {event} {url} {interactive} class="card card-interactive">
    {@render body()}
  </Cv>
{:else}
  <NoteCard {event} {url} {interactive}>
    {@render body()}
  </NoteCard>
{/if}
