<script lang="ts">
  import type {TrustedEvent} from "@welshman/util"
  import CloseCircle from "@assets/icons/close-circle.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import ComposeBar from "@app/components/ComposeBar.svelte"
  import NoteContentMinimal from "@app/components/NoteContentMinimal.svelte"
  import {profiles} from "@app/core/plugins"

  type Props = {
    verb: string
    event: TrustedEvent
    clear: () => void
  }

  const {verb, event, clear}: Props = $props()

  const display = $profiles.display(event.pubkey).$
</script>

<ComposeBar class="relative pr-8">
  <p class="text-primary text-xs">{verb} @{$display}</p>
  {#key event.id}
    <NoteContentMinimal {event} />
  {/key}
  <Button class="absolute right-2 top-2 cursor-pointer" onclick={clear}>
    <Icon icon={CloseCircle} />
  </Button>
</ComposeBar>
