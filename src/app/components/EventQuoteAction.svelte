<script lang="ts">
  import type {TrustedEvent} from "@welshman/util"
  import PenNewSquare from "@assets/icons/pen-new-square.svg?dataurl"
  import Button from "@lib/components/Button.svelte"
  import Icon from "@lib/components/Icon.svelte"
  import {quoteEvent} from "@app/features/quotes"

  type Props = {
    event: TrustedEvent
    noun: string
  }

  const {event, noun}: Props = $props()

  const quote = () => quoteEvent(event)
</script>

<li>
  <Button onclick={quote}>
    <Icon size={4} icon={PenNewSquare} />
    Quote {noun}
  </Button>
</li>
