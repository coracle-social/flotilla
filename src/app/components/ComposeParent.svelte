<script lang="ts">
  import {removeUndefined} from "@welshman/lib"
  import type {TrustedEvent} from "@welshman/util"
  import CloseCircle from "@assets/icons/close-circle.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import ComposeBar from "@app/components/ComposeBar.svelte"
  import NoteContentMinimal from "@app/components/NoteContentMinimal.svelte"
  import {profiles} from "@app/core"

  type Props = {
    url?: string
    verb: string
    event: TrustedEvent
    clear: () => void
  }

  const {url, verb, event, clear}: Props = $props()

  const display = $profiles.display(event.pubkey, removeUndefined([url])).$
</script>

<ComposeBar class="relative pr-8">
  <p class="text-primary text-xs">{verb} @{$display}</p>
  {#key event.id}
    <NoteContentMinimal trimParent {event} />
  {/key}
  <Button class="absolute right-2 top-2 cursor-pointer" onclick={clear}>
    <Icon icon={CloseCircle} />
  </Button>
</ComposeBar>
