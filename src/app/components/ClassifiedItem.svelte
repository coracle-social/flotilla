<script lang="ts">
  import {formatTimestamp} from "@welshman/lib"
  import type {TrustedEvent} from "@welshman/util"
  import {getAddress} from "@welshman/util"
  import {Classified} from "@welshman/domain"
  import Link from "@lib/components/Link.svelte"
  import CurrencySymbol from "@lib/components/CurrencySymbol.svelte"
  import {reader} from "@app/core"
  import ContentLinkBlock from "@app/components/ContentLinkBlock.svelte"
  import Content from "@app/components/Content.svelte"
  import ProfileLink from "@app/components/ProfileLink.svelte"
  import ClassifiedActions from "@app/components/ClassifiedActions.svelte"
  import type {FeedContext} from "@app/feeds"
  import RoomLink from "@app/components/RoomLink.svelte"
  import UnreadDot from "@app/components/UnreadDot.svelte"
  import {makeClassifiedPath} from "@app/routes"

  type Props = {
    url: string
    event: TrustedEvent
    context: FeedContext
  }

  const {url, event, context}: Props = $props()

  const path = $derived(makeClassifiedPath(url, getAddress(event)))
  const classified = $derived(reader(Classified)(event))
  const title = $derived(classified.title())
  const h = $derived(classified.room())
  const images = $derived(new Set(classified.images()))
  const price = $derived(classified.price())
</script>

<Link class="cv relative flex flex-col gap-2 card card-interactive w-full" href={path}>
  <UnreadDot {path} class="absolute right-3 top-3" />
  {#if title}
    <div class="flex w-full items-center justify-between gap-2">
      <p class="text-xl">
        {title} —
        <CurrencySymbol code={price?.currency ?? "SAT"} />{price?.amount ?? 0}
      </p>
      <p class="text-sm opacity-75">
        {formatTimestamp(event.created_at)}
      </p>
    </div>
  {:else}
    <p class="mb-3 h-0 text-xs opacity-75">
      {formatTimestamp(event.created_at)}
    </p>
  {/if}
  <Content {event} {url} expandMode="inline" />
  <div class="grid grid-cols-3 sm:grid-cols-5">
    {#each images as image (image)}
      <ContentLinkBlock {event} value={{url: image}} />
    {/each}
  </div>
  <div class="flex w-full flex-col items-end justify-between gap-2 sm:flex-row">
    <span class="whitespace-nowrap py-1 text-sm opacity-75">
      Posted by
      <ProfileLink pubkey={event.pubkey} {url} />
      {#if h}
        in <RoomLink {url} {h} />
      {/if}
    </span>
    <ClassifiedActions showActivity {url} {event} {context} />
  </div>
</Link>
