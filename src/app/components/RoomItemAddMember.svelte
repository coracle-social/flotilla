<script lang="ts">
  import type {TrustedEvent} from "@welshman/util"
  import {tagValues, hexTags} from "@welshman/util"
  import Button from "@lib/components/Button.svelte"
  import ProfileLink from "@app/components/ProfileLink.svelte"
  import RoomMembersJoined from "@app/components/RoomMembersJoined.svelte"
  import {pushModal} from "@app/navigation/dialogs"

  type Props = {
    url: string
    events: TrustedEvent[]
  }

  const {url, events}: Props = $props()

  // The same person joining twice in a run counts once.
  const pubkeys = $derived([
    ...new Set(events.flatMap(event => tagValues(hexTags("p"), event.tags))),
  ])

  const showAll = () => pushModal(RoomMembersJoined, {url, pubkeys})
</script>

<div class="py-1 text-center text-xs opacity-75">
  {#if pubkeys.length === 1}
    <ProfileLink unstyled class="text-primary" {url} pubkey={pubkeys[0]} /> joined the room
  {:else}
    <Button class="text-primary cursor-pointer" onclick={showAll}>{pubkeys.length} people</Button> joined
    the room
  {/if}
</div>
