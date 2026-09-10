<script lang="ts">
  import type {TrustedEvent} from "@welshman/util"
  import {Classified} from "@welshman/domain"
  import {ucFirst} from "@lib/util"
  import Badge from "@lib/components/Badge.svelte"
  import {reader} from "@app/core"

  type Props = {
    event: TrustedEvent
  }

  const {event}: Props = $props()

  const status = $derived(reader(Classified)(event).status())
</script>

{#if status}
  <Badge variant={status !== "active" ? "primary" : "neutral"} class="badge-sm rounded-full">
    {ucFirst(status)}
  </Badge>
{/if}
