<script lang="ts">
  import * as nip19 from "nostr-tools/nip19"
  import {derived, writable} from "svelte/store"
  import {removeUndefined} from "@welshman/lib"
  import type {TrustedEvent} from "@welshman/util"
  import {
    Address,
    MESSAGE,
    eventOutbox,
    fromNostrURI,
    getIdFilters,
    relays as relaySelections,
    seen,
  } from "@welshman/util"
  import Button from "@lib/components/Button.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import NoteCard from "@app/components/NoteCard.svelte"
  import NoteContent from "@app/components/NoteContent.svelte"
  import NoteContentMinimal from "@app/components/NoteContentMinimal.svelte"
  import {events, network, router} from "@app/core"
  import {entityLink} from "@app/env"
  import {goToEvent} from "@app/routes"

  type Props = {
    value: any
    raw: string
    event: TrustedEvent
    inline?: boolean
    url?: string
  }

  const {value, raw, event, inline = false, url}: Props = $props()

  const {id, identifier, kind, pubkey = value.author, relays = []} = value
  const idOrAddress = id || new Address(kind, pubkey, identifier).toString()
  const ref = {id, pubkey, kind, identifier, relays}
  const hints = removeUndefined([...relays, url])

  const mergedRelays = writable(hints)

  const quote = $events.one(idOrAddress, hints).$

  // Whoever quoted the event must have seen it, so the quoting event's relays are asked too.
  const ask = () =>
    $router.resolver
      .relays([
        ...relaySelections(removeUndefined([url])),
        seen(ref),
        eventOutbox(ref),
        seen(event, 0.5),
      ])
      .then(urls => {
        mergedRelays.set(urls)

        if (!$quote) {
          $network.loadLenient({filters: getIdFilters([idOrAddress]), relays: urls})
        }
      })

  ask()

  // A load can settle before the event reaches the repository, so ask again while it is missing.
  let attempts = $state(0)
  let failed = $state(false)

  $effect(() => {
    if ($quote || failed) return

    if (attempts >= 3) {
      failed = true
      return
    }

    const timer = setTimeout(() => {
      attempts += 1
      ask()
    }, 5000)

    return () => clearTimeout(timer)
  })

  const entity = derived(mergedRelays, $mergedRelays =>
    id
      ? nip19.neventEncode({id, relays: $mergedRelays})
      : new Address(kind, pubkey, identifier, $mergedRelays).toNaddr(),
  )

  const onclick = () => {
    if ($quote) {
      goToEvent($quote)
    } else {
      window.open(entityLink($entity))
    }
  }
</script>

<Button
  class={inline
    ? "max-w-full cursor-pointer overflow-hidden text-ellipsis whitespace-nowrap underline"
    : "my-2 block w-full max-w-full text-left"}
  {onclick}>
  {#if inline}
    {fromNostrURI(raw).slice(0, 16) + "…"}
  {:else if $quote}
    {#if $quote.content.trim().match(/^(nostr:)?nevent1[a-z0-9]+$/)}
      <NoteContent {url} event={$quote} />
    {:else if $quote.kind === MESSAGE}
      <div
        class="border-l-2 border-solid py-1 pl-2 opacity-90"
        style="border-left-color: var(--primary); background-color: color-mix(in srgb, var(--primary) 10%, var(--surface-more) 90%);">
        <NoteContentMinimal trimParent {url} event={$quote} />
      </div>
    {:else}
      <NoteCard event={$quote} {url} class="border border-solid rounded-2xl p-4 border-line">
        <NoteContentMinimal {url} event={$quote} />
      </NoteCard>
    {/if}
  {:else if failed}
    <div class="rounded-2xl p-4 opacity-75">Couldn't load this event</div>
  {:else}
    <div class="rounded-2xl p-4">
      <Spinner loading>Loading event...</Spinner>
    </div>
  {/if}
</Button>
