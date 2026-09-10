<script lang="ts">
  import cx from "classnames"
  import {formatTimestampRelative, uniq} from "@welshman/lib"
  import type {TrustedEvent} from "@welshman/util"
  import {getAddress} from "@welshman/util"
  import {Classified} from "@welshman/domain"
  import Gallery from "@assets/icons/gallery.svg?dataurl"
  import CaseMinimalistic from "@assets/icons/case-minimalistic.svg?dataurl"
  import {normalizeTopic} from "@lib/util"
  import Icon from "@lib/components/Icon.svelte"
  import Link from "@lib/components/Link.svelte"
  import Cv from "@lib/components/Cv.svelte"
  import CurrencySymbol from "@lib/components/CurrencySymbol.svelte"
  import {reader} from "@app/core"
  import ProfileLink from "@app/components/ProfileLink.svelte"
  import ClassifiedActions from "@app/components/ClassifiedActions.svelte"
  import type {FeedContext} from "@app/feeds"
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
  const summary = $derived(classified.summary() || event.content)
  const images = $derived(uniq(classified.images()))
  const cover = $derived(images[0])
  const extraImages = $derived(images.slice(1))
  const price = $derived(classified.price())
  const topics = $derived(uniq(classified.topics() ?? []).map(normalizeTopic))
  const isSold = $derived(classified.status() === "sold")
  // Zero is the form's default, not a claim that the listing is free.
  const hasPrice = $derived(Boolean(price && price.amount > 0))
</script>

<Cv
  tag={Link}
  class="group card card-interactive card-media flex h-full w-full flex-col"
  href={makeClassifiedPath(url, getAddress(event))}>
  <div class="relative aspect-[4/3] w-full overflow-hidden bg-surface-more">
    <UnreadDot {path} class="absolute right-3 top-3" />
    {#if cover}
      <img
        src={cover}
        alt=""
        class={cx(
          "h-full w-full object-cover transition-transform duration-300 group-hover:scale-105",
          isSold && "opacity-40 grayscale",
        )} />
    {:else}
      <div class="flex h-full w-full items-center justify-center">
        <Icon icon={CaseMinimalistic} size={10} class="opacity-20" />
      </div>
    {/if}
    {#if isSold}
      <span class="badge badge-neutral badge-sm absolute top-3 left-3">Sold</span>
    {/if}
    {#if extraImages.length > 0}
      <span
        class="absolute right-3 bottom-3 flex items-center gap-1 rounded-full bg-black/60 px-2 py-1 text-xs font-bold text-white">
        <Icon icon={Gallery} size={3} />
        {images.length}
      </span>
    {/if}
  </div>
  <div class="flex min-w-0 grow flex-col gap-2 p-4">
    <p class="line-clamp-2 wrap-break-word font-bold leading-snug">{title}</p>
    {#if hasPrice}
      <p class="text-xl leading-none font-bold text-primary">
        <CurrencySymbol code={price?.currency ?? "SAT"} />{price?.amount.toLocaleString()}
      </p>
    {/if}
    {#if summary}
      <p class="line-clamp-2 wrap-break-word text-sm text-content-muted">{summary}</p>
    {/if}
    {#if topics.length > 0}
      <div class="flex min-w-0 flex-wrap gap-1">
        {#each topics.slice(0, 2) as topic (topic)}
          <span class="badge badge-sm rounded-full font-normal">#{topic}</span>
        {/each}
        {#if topics.length > 2}
          <span class="badge badge-sm rounded-full font-normal">+{topics.length - 2}</span>
        {/if}
      </div>
    {/if}
  </div>
  <div
    class="flex min-w-0 items-center justify-between gap-2 border-t border-solid border-line px-4 py-3">
    <span class="flex min-w-0 flex-col text-xs text-content-muted">
      <span class="truncate">
        <ProfileLink pubkey={event.pubkey} {url} />
      </span>
      <span class="truncate">{formatTimestampRelative(event.created_at)}</span>
    </span>
    <ClassifiedActions {url} {event} {context} showTopics={false} showStatus={false} />
  </div>
</Cv>
