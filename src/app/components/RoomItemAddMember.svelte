<script lang="ts">
  import type {TrustedEvent} from "@welshman/util"
  import {tagValues, hexTags} from "@welshman/util"
  import ProfileLink from "@app/components/ProfileLink.svelte"

  type Props = {
    url: string
    events: TrustedEvent[]
  }

  const {url, events}: Props = $props()

  // The same person joining twice in a run counts once.
  const pubkeys = $derived([
    ...new Set(events.flatMap(event => tagValues(hexTags("p"), event.tags))),
  ])

  const separator = (i: number) => (i === 0 ? "" : i === pubkeys.length - 1 ? " and " : ", ")
</script>

<div class="py-1 text-center text-xs opacity-75">
  {#each pubkeys as pubkey, i (pubkey)}
    {separator(i)}<ProfileLink unstyled class="text-primary" {url} {pubkey} />
  {/each} joined the room
</div>
