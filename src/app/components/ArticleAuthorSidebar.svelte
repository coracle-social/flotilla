<script lang="ts">
  import {onMount} from "svelte"
  import {sortBy} from "@welshman/lib"
  import {formatTimestamp} from "@welshman/lib"
  import type {TrustedEvent} from "@welshman/util"
  import {LONG_FORM, getAddress} from "@welshman/util"
  import {Article} from "@welshman/domain"
  import Link from "@lib/components/Link.svelte"
  import Profile from "@app/components/Profile.svelte"
  import ProfileName from "@app/components/ProfileName.svelte"
  import ProfileAbout from "@app/components/ProfileAbout.svelte"
  import {network, reader} from "@app/core"
  import {deriveEventsForUrl} from "@app/repository"
  import {displayReadingTime} from "@app/articles"
  import {makeArticlePath} from "@app/routes"

  type Props = {
    url: string
    event: TrustedEvent
  }

  const {url, event}: Props = $props()

  const MAX_ARTICLES = 6

  const filters = [{kinds: [LONG_FORM], authors: [event.pubkey], limit: 20}]
  const events = deriveEventsForUrl(url, filters)
  const address = getAddress(event)

  const articleCount = $derived($events.length)

  const others = $derived(
    sortBy(
      e => -reader(Article)(e).publishedAt(),
      $events.filter(e => getAddress(e) !== address),
    ).slice(0, MAX_ARTICLES),
  )

  onMount(() => {
    const controller = new AbortController()

    $network.request({relays: [url], filters, signal: controller.signal})

    return () => controller.abort()
  })
</script>

<aside
  class="bg-surface flex w-full shrink-0 flex-col border-t lg:w-80 lg:border-t-0"
  style="border-color: var(--line)">
  <div class="flex flex-col lg:sticky lg:top-0">
    <section class="flex flex-col gap-3 border-b px-4 py-4" style="border-color: var(--line)">
      <Profile pubkey={event.pubkey} {url} />
      <div class="text-content-muted line-clamp-3 text-sm leading-snug">
        <ProfileAbout pubkey={event.pubkey} {url} />
      </div>
      <p class="text-content-subtle text-xs font-bold tracking-wide uppercase">
        {articleCount}
        {articleCount === 1 ? "article" : "articles"} in this space
      </p>
    </section>
    {#if others.length > 0}
      <section class="flex flex-col gap-2 px-4 py-4">
        <h2 class="text-sm font-bold tracking-wide uppercase opacity-60">
          More from <ProfileName pubkey={event.pubkey} {url} />
        </h2>
        <div class="flex flex-col">
          {#each others as other (getAddress(other))}
            {@const article = reader(Article)(other)}
            <Link
              href={makeArticlePath(url, getAddress(other))}
              class="hover:bg-surface-less -mx-2 flex items-start gap-3 rounded-xl px-2 py-2 transition-colors">
              <div class="flex min-w-0 grow flex-col gap-1">
                <p class="line-clamp-2 text-sm font-bold">{article.title() || "Untitled"}</p>
                <p class="text-xs opacity-75">
                  {formatTimestamp(article.publishedAt())} · {displayReadingTime(other.content)}
                </p>
              </div>
              {#if article.image()}
                <img
                  src={article.image()}
                  alt=""
                  class="h-12 w-16 shrink-0 rounded-lg object-cover" />
              {/if}
            </Link>
          {/each}
        </div>
      </section>
    {/if}
  </div>
</aside>
