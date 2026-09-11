<script lang="ts">
  import {NOTE} from "@welshman/util"
  import Pin from "@assets/icons/pin.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import NoteCard from "@app/components/NoteCard.svelte"
  import NoteContent from "@app/components/NoteContent.svelte"
  import {derivePinnedEvents} from "@app/pins"

  type Props = {
    pubkey: string
    url?: string
  }

  const {pubkey, url}: Props = $props()

  const pinnedEvents = derivePinnedEvents(pubkey)

  const event = $derived($pinnedEvents.find(e => e.kind === NOTE))
</script>

{#if event}
  <div class="flex flex-col gap-2">
    <p class="text-content-muted flex items-center gap-2 text-sm">
      <Icon icon={Pin} size={4} />
      Pinned note
    </p>
    <NoteCard {event} {url} hideProfile class="card">
      <NoteContent {event} {url} minLength={120} maxLength={240} expandMode="inline" />
    </NoteCard>
  </div>
{/if}
