<script lang="ts">
  import * as nip19 from "nostr-tools/nip19"
  import {Router} from "@welshman/router"
  import type {TrustedEvent} from "@welshman/util"
  import {Address, MESSAGE} from "@welshman/util"
  import Button from "@lib/components/Button.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import NoteCard from "@app/components/NoteCard.svelte"
  import NoteContent from "@app/components/NoteContent.svelte"
  import {deriveEvent, entityLink} from "@app/state"
  import {goToEvent} from "@app/routes"

  type Props = {
    value: any
    hideMediaAtDepth: number
    event: TrustedEvent
    depth: number
    url?: string
    minimal?: boolean
  }

  const {value, event, depth, hideMediaAtDepth, url, minimal}: Props = $props()

  const {id, identifier, kind, pubkey, relays = []} = value
  const idOrAddress = id || new Address(kind, pubkey, identifier).toString()
  const mergedRelays = Router.get().Quote(event, idOrAddress, relays).getUrls()

  if (url) {
    mergedRelays.push(url)
  }

  const quote = deriveEvent(idOrAddress, mergedRelays)
  const entity = id
    ? nip19.neventEncode({id, relays: mergedRelays})
    : new Address(kind, pubkey, identifier, mergedRelays).toNaddr()

  const onclick = () => {
    if ($quote) {
      goToEvent($quote)
    } else {
      window.open(entityLink(entity))
    }
  }
</script>

<Button class="my-2 block max-w-full text-left" {onclick}>
  {#if $quote}
    {#if minimal && $quote.kind === MESSAGE}
      <div
        class="border-l-2 border-solid border-l-primary py-1 pl-2 opacity-90"
        style="background-color: color-mix(in srgb, var(--primary) 10%, var(--base-300) 90%);">
        <NoteContent {hideMediaAtDepth} {url} event={$quote} depth={depth + 1} />
      </div>
    {:else}
      <NoteCard event={$quote} {url} class="bg-alt rounded-box p-4">
        <NoteContent {hideMediaAtDepth} {url} event={$quote} depth={depth + 1} />
      </NoteCard>
    {/if}
  {:else}
    <div class="rounded-box p-4">
      <Spinner loading>Loading event...</Spinner>
    </div>
  {/if}
</Button>
