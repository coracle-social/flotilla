<script lang="ts">
  import {formatTimestamp} from "@welshman/lib"
  import type {TrustedEvent} from "@welshman/util"
  import {getAddress} from "@welshman/util"
  import {Article} from "@welshman/domain"
  import Link from "@lib/components/Link.svelte"
  import Cv from "@lib/components/Cv.svelte"
  import Content from "@app/components/Content.svelte"
  import ProfileLink from "@app/components/ProfileLink.svelte"
  import ArticleActions from "@app/components/ArticleActions.svelte"
  import UnreadDot from "@app/components/UnreadDot.svelte"
  import type {FeedContext} from "@app/feeds"
  import {reader} from "@app/core"
  import {makeArticlePath} from "@app/routes"

  type Props = {
    url: string
    event: TrustedEvent
    context: FeedContext
  }

  const {url, event, context}: Props = $props()

  const path = $derived(makeArticlePath(url, getAddress(event)))
  const article = $derived(reader(Article)(event))
  const title = $derived(article.title())
  const summary = $derived(article.summary())
  const image = $derived(article.image())
</script>

<Cv data-component="ArticleItem" class="relative w-full card card-interactive">
  <!-- An overlay rather than a wrapper: the card carries a profile button and the room and action
       links, and none of those may sit inside an anchor. -->
  <Link class="absolute inset-0 rounded-2xl" href={path} aria-label={title || "Untitled"} />
  <UnreadDot {path} class="absolute right-3 top-3" />
  <div class="pointer-events-none relative flex flex-col gap-2">
    {#if image}
      <img src={image} alt="" class="h-40 w-full rounded-2xl object-cover" />
    {/if}
    <div class="flex w-full items-center justify-between gap-2">
      <p class="text-xl">{title || "Untitled"}</p>
      <p class="whitespace-nowrap text-sm opacity-75">
        {formatTimestamp(article.publishedAt())}
      </p>
    </div>
    <Content
      event={{content: summary || event.content, tags: event.tags}}
      {url}
      expandMode="inline"
      minLength={100}
      maxLength={300} />
    <div class="flex w-full flex-col items-end justify-between gap-2 sm:flex-row">
      <span class="pointer-events-auto whitespace-nowrap py-1 text-sm opacity-75">
        Written by
        <ProfileLink pubkey={event.pubkey} {url} />
      </span>
      <div class="pointer-events-auto">
        <ArticleActions showRoom showActivity {url} {event} {context} />
      </div>
    </div>
  </div>
</Cv>
