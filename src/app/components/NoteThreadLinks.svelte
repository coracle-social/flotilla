<script lang="ts">
  import {EventRef} from "@welshman/util"
  import type {TrustedEvent} from "@welshman/util"
  import AltArrowUp from "@assets/icons/alt-arrow-up.svg?dataurl"
  import NotesMinimalistic from "@assets/icons/notes-minimalistic.svg?dataurl"
  import Button from "@lib/components/Button.svelte"
  import Icon from "@lib/components/Icon.svelte"
  import NoteDetail from "@app/components/NoteDetail.svelte"
  import {app} from "@app/core/app"
  import {getThreadRefs} from "@app/features/interactions"
  import {pushModal} from "@app/navigation/dialogs"
  import {openNote} from "@app/navigation/overlays"

  type Props = {
    event: TrustedEvent
  }

  const {event}: Props = $props()

  const refs = $derived(getThreadRefs(event))

  const parent = $derived(refs.parent ?? refs.root)

  const hasThread = $derived(refs.root?.getAddressOrId() !== parent?.getAddressOrId())

  const relays = Array.from($app.repository.tracker.getRelays(event.id))

  // Seen relays stand in as hints; the note's own routing resolves behind the overlay.
  const open = (target: EventRef) => () => {
    openNote(EventRef.merge(target, {relays}))
  }

  const openThread = () => {
    pushModal(NoteDetail, {ref: EventRef.fromEvent(event, relays), thread: true}, {size: "large"})
  }
</script>

{#if parent}
  <div class="flex flex-wrap items-center gap-3 text-sm">
    <Button class="link flex items-center gap-1" onclick={open(parent)}>
      <Icon icon={AltArrowUp} size={4} />
      View parent
    </Button>
    {#if hasThread}
      <Button class="link flex items-center gap-1" onclick={openThread}>
        <Icon icon={NotesMinimalistic} size={4} />
        View thread
      </Button>
    {/if}
  </div>
{/if}
