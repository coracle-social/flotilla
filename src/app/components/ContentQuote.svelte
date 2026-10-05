<script lang="ts">
  import {removeUndefined} from "@welshman/lib"
  import type {TrustedEvent} from "@welshman/util"
  import {MESSAGE, ROOM_META, fromNostrURI, getIdFilters, normalizeRelayUrl} from "@welshman/util"
  import Button from "@lib/components/Button.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import NoteCard from "@app/components/NoteCard.svelte"
  import NoteContent from "@app/components/NoteContent.svelte"
  import NoteContentMinimal from "@app/components/NoteContentMinimal.svelte"
  import RoomLink from "@app/components/RoomLink.svelte"
  import {events, network} from "@app/core"
  import {getQuoteIdOrAddress, getQuoteRelays, goToQuote} from "@app/quotes"
  import type {QuotePointer} from "@app/quotes"

  type Props = {
    value: QuotePointer
    raw: string
    event: TrustedEvent
    inline?: boolean
    url?: string
  }

  const {value, raw, event, inline = false, url}: Props = $props()

  const idOrAddress = getQuoteIdOrAddress(value)
  const hints = removeUndefined([...(value.relays ?? []), url])
  const quote = $events.one(idOrAddress, hints).$

  getQuoteRelays(value, event, url).then(relays => {
    if (!$quote) {
      $network.loadLenient({filters: getIdFilters([idOrAddress]), relays})
    }
  })
</script>

{#if value.kind === ROOM_META && hints.length > 0}
  <RoomLink url={normalizeRelayUrl(hints[0])} h={value.identifier ?? ""} />
{:else}
  <Button
    class={inline
      ? "max-w-full cursor-pointer overflow-hidden text-ellipsis whitespace-nowrap underline"
      : "my-2 block w-full max-w-full text-left"}
    onclick={() => goToQuote(value, event, url)}>
    {#if inline}
      {fromNostrURI(raw).slice(0, 16) + "…"}
    {:else if $quote}
      {#if $quote.content.trim().match(/^(nostr:)?nevent1[a-z0-9]+$/)}
        <NoteContent {url} event={$quote} />
      {:else if $quote.kind === MESSAGE}
        <div
          class="border-l-2 border-solid py-1 pl-2 opacity-90"
          style="border-left-color: var(--primary); background-color: color-mix(in srgb, var(--primary) 10%, var(--surface-more) 90%);">
          <NoteContentMinimal {url} event={$quote} />
        </div>
      {:else}
        <NoteCard event={$quote} {url} class="border border-solid rounded-2xl p-4 border-line">
          <NoteContentMinimal {url} event={$quote} />
        </NoteCard>
      {/if}
    {:else}
      <div class="rounded-2xl p-4">
        <Spinner loading>Loading event...</Spinner>
      </div>
    {/if}
  </Button>
{/if}
