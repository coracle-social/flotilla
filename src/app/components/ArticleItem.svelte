<script lang="ts">
  import {formatTimestamp, uniq} from "@welshman/lib"
  import type {TrustedEvent} from "@welshman/util"
  import {getAddress} from "@welshman/util"
  import {Article} from "@welshman/domain"
  import Link from "@lib/components/Link.svelte"
  import Cv from "@lib/components/Cv.svelte"
  import ArticleExcerpt from "@app/components/ArticleExcerpt.svelte"
  import ProfileLink from "@app/components/ProfileLink.svelte"
  import ContentActions from "@app/components/ContentActions.svelte"
  import UnreadDot from "@app/components/UnreadDot.svelte"
  import type {EngagementIndex} from "@app/features/engagement"
  import {reader} from "@app/core/domain"
  import {getPublishedTimestamp} from "@app/features/spaces/articles"
  import * as pages from "@app/navigation/pages"

  type Props = {
    url: string
    event: TrustedEvent
    engagement: EngagementIndex
  }

  const {url, event, engagement}: Props = $props()

  const path = $derived(pages.article.path({url, address: getAddress(event)}))
  const article = $derived(reader(Article)(event))
  const title = $derived(article.title())
  const image = $derived(article.image())
  const topics = $derived(uniq(article.topics()))
</script>

{#snippet topicLabels()}
  {#each topics as topic (topic)}
    <span class="button button-xs rounded-full font-normal">#{topic}</span>
  {/each}
{/snippet}

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
        {formatTimestamp(getPublishedTimestamp(event))}
      </p>
    </div>
    <ArticleExcerpt {event} />
    <div class="flex w-full flex-col items-end justify-between gap-2 sm:flex-row">
      <span class="pointer-events-auto whitespace-nowrap py-1 text-sm opacity-75">
        Written by
        <ProfileLink pubkey={event.pubkey} {url} />
      </span>
      <div class="pointer-events-auto">
        <ContentActions
          showRoom
          showActivity
          noun="Article"
          labels={topics.length > 0 ? topicLabels : undefined}
          {url}
          {event}
          {engagement} />
      </div>
    </div>
  </div>
</Cv>
