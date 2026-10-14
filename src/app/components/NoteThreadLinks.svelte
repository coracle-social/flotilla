<script lang="ts">
  import type {EventRef, TrustedEvent} from "@welshman/util"
  import AltArrowUp from "@assets/icons/alt-arrow-up.svg?dataurl"
  import NotesMinimalistic from "@assets/icons/notes-minimalistic.svg?dataurl"
  import Button from "@lib/components/Button.svelte"
  import Icon from "@lib/components/Icon.svelte"
  import {openNote} from "@app/navigation/overlays"
  import {getReplyRefs} from "@app/features/social"

  type Props = {
    event: TrustedEvent
  }

  const {event}: Props = $props()

  const refs = $derived(getReplyRefs(event))

  const parent = $derived(refs.parent ?? refs.root)

  const thread = $derived(
    refs.root?.getAddressOrId() === parent?.getAddressOrId() ? undefined : refs.root,
  )

  const open = (target: EventRef) => () => openNote(target)
</script>

{#if parent || thread}
  <div class="flex flex-wrap items-center gap-3 text-sm">
    {#if parent}
      <Button class="link flex items-center gap-1" onclick={open(parent)}>
        <Icon icon={AltArrowUp} size={4} />
        View parent
      </Button>
    {/if}
    {#if thread}
      <Button class="link flex items-center gap-1" onclick={open(thread)}>
        <Icon icon={NotesMinimalistic} size={4} />
        View thread
      </Button>
    {/if}
  </div>
{/if}
