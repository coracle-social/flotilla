<script lang="ts">
  import {derived} from "svelte/store"
  import {filter, formatTimestampRelative, max, spec, uniq} from "@welshman/lib"
  import {COMMENT} from "@welshman/util"
  import type {PinReader, PinboardReader} from "@welshman/domain"
  import {normalizeTopic} from "@lib/util"
  import ChatRoundDots from "@assets/icons/chat-round-dots.svg?dataurl"
  import GalleryWide from "@assets/icons/gallery-wide.svg?dataurl"
  import Cv from "@lib/components/Cv.svelte"
  import Icon from "@lib/components/Icon.svelte"
  import Link from "@lib/components/Link.svelte"
  import ProfileCircles from "@app/components/ProfileCircles.svelte"
  import UnreadDot from "@app/components/UnreadDot.svelte"
  import type {FeedContext} from "@app/features/feeds"
  import {shelfCoverImages} from "@app/features/pinboards"
  import {makeLibraryPath} from "@app/ui/routes"

  type Props = {
    url: string
    board: PinboardReader
    pins: PinReader[]
    context: FeedContext
  }

  const {url, board, pins, context}: Props = $props()

  const path = makeLibraryPath(url, board.address())
  const related = context.related(board.event)
  const comments = derived(related, $related => filter(spec({kind: COMMENT}), $related))

  const title = $derived(board.title() || "Untitled shelf")
  const topics = $derived(uniq(board.topics().map(normalizeTopic)))
  const contributors = $derived(uniq([board.event.pubkey, ...pins.map(pin => pin.event.pubkey)]))

  const cover = $derived.by(() => {
    const image = board.image()

    return image ? [image] : shelfCoverImages(pins)
  })

  const lastActive = $derived(
    max([
      board.event.created_at,
      ...pins.map(pin => pin.event.created_at),
      ...$comments.map(comment => comment.created_at),
    ]),
  )
</script>

<Cv
  tag={Link}
  data-component="PinboardItem"
  href={path}
  aria-label={title}
  class="group card card-interactive card-media flex h-full w-full flex-col">
  <div class="relative h-32 w-full shrink-0 overflow-hidden bg-surface-more">
    {#if cover.length > 0}
      <div
        class="grid h-full auto-cols-fr grid-flow-col gap-px transition-transform duration-300 group-hover:scale-105">
        {#each cover as image (image)}
          <img src={image} alt="" class="h-full w-full object-cover" />
        {/each}
      </div>
    {:else}
      <div class="flex h-full w-full items-center justify-center">
        <Icon icon={GalleryWide} size={10} class="opacity-20" />
      </div>
    {/if}
    <UnreadDot {path} class="absolute right-3 top-3 z-feature" />
  </div>
  <div class="flex min-w-0 grow flex-col gap-2 p-4">
    <p class="wrap-break-word text-xl leading-snug">{title}</p>
    {#if board.description()}
      <p class="line-clamp-2 wrap-break-word text-sm text-content-muted">{board.description()}</p>
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
    class="flex min-w-0 items-center justify-between gap-2 border-t border-solid border-line px-4 py-3 text-xs text-content-muted">
    <span class="flex items-center gap-3">
      <span>{pins.length} {pins.length === 1 ? "link" : "links"}</span>
      {#if $comments.length > 0}
        <span class="flex items-center gap-1">
          <Icon size={3} icon={ChatRoundDots} />
          {$comments.length}
        </span>
      {/if}
    </span>
    <span class="flex items-center gap-2">
      <ProfileCircles pubkeys={contributors} size={5} limit={4} />
      <span class="whitespace-nowrap">{formatTimestampRelative(lastActive)}</span>
    </span>
  </div>
</Cv>
