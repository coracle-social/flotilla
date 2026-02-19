<script lang="ts">
  import {formatTimestamp} from "@welshman/lib"
  import type {TrustedEvent} from "@welshman/util"
  import {getTag, getAddress, getTagValue, getTagValues} from "@welshman/util"
  import Link from "@lib/components/Link.svelte"
  import CurrencySymbol from "@lib/components/CurrencySymbol.svelte"
  import ContentLinkBlock from "@app/components/ContentLinkBlock.svelte"
  import Content from "@app/components/Content.svelte"
  import ProfileLink from "@app/components/ProfileLink.svelte"
  import ClassifiedActions from "@app/components/ClassifiedActions.svelte"
  import RoomLink from "@app/components/RoomLink.svelte"
  import {makeClassifiedPath} from "@app/util/routes"

  type Props = {
    url: string
    event: TrustedEvent
  }

  const {url, event}: Props = $props()

  const title = getTagValue("title", event.tags)
  const h = getTagValue("h", event.tags)
  const images = getTagValues("image", event.tags)
  const [_, price = 0, currency = "SAT"] = getTag("price", event.tags) || []
</script>

<Link
  class="cv col-2 card2 bg-alt w-full cursor-pointer shadow-xl"
  href={makeClassifiedPath(url, getAddress(event))}>
  {#if title}
    <div class="flex w-full items-center justify-between gap-2">
      <p class="text-xl">
        {title} —
        <CurrencySymbol code={currency} />{price}
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
    <ClassifiedActions showActivity {url} {event} />
  </div>
</Link>
