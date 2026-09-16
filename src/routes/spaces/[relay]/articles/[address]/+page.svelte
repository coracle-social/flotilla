<script lang="ts">
  import {onDestroy} from "svelte"
  import {derived} from "svelte/store"
  import {formatTimestamp, sleep, uniq} from "@welshman/lib"
  import {Article} from "@welshman/domain"
  import Link from "@lib/components/Link.svelte"
  import PageContent from "@lib/components/PageContent.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import MenuButton from "@lib/components/MenuButton.svelte"
  import SpaceBar from "@app/components/SpaceBar.svelte"
  import ContentMarkdown from "@app/components/ContentMarkdown.svelte"
  import Profile from "@app/components/Profile.svelte"
  import RoomName from "@app/components/RoomName.svelte"
  import ArticleActions from "@app/components/ArticleActions.svelte"
  import ArticleAuthorSidebar from "@app/components/ArticleAuthorSidebar.svelte"
  import EventComments from "@app/components/EventComments.svelte"
  import EventMenu from "@app/components/EventMenu.svelte"
  import ReadingProgress from "@app/components/ReadingProgress.svelte"
  import {reader} from "@app/core"
  import {deriveEvent} from "@app/repository"
  import {makeFeedContext} from "@app/feeds"
  import {decodeRelay} from "@app/relays"
  import {displayReadingTime} from "@app/articles"
  import {makeSpacePath} from "@app/routes"
  import type {PageProps} from "./$types"

  const {params}: PageProps = $props()

  const {relay, address} = params
  const url = decodeRelay(relay)
  const context = makeFeedContext({relays: [url]})
  const event = deriveEvent(address, [url])
  const article = derived(event, $event => ($event ? reader(Article)($event) : undefined))
  const h = $derived($article?.room())
  const topics = $derived(uniq($article?.topics() ?? []))

  const back = () => history.back()

  let contentElement = $state<Element>()

  onDestroy(context.cleanup)
</script>

<SpaceBar {back} class="!h-auto min-h-20 py-3">
  {#snippet title()}
    <div class="flex min-w-0 flex-col gap-0.5">
      <h1 class="truncate min-w-0 font-bold sm:text-xl">{$article?.title() ?? ""}</h1>
      {#if $article && h}
        <p class="text-xs opacity-75">
          <Link href={makeSpacePath(url, h)} class="link">#<RoomName {url} {h} /></Link>
        </p>
      {/if}
    </div>
  {/snippet}
  {#snippet action()}
    {#if $event}
      <MenuButton
        component={EventMenu}
        componentProps={{url, noun: "Article", event: $event}}
        aria-label="Article options" />
    {/if}
  {/snippet}
</SpaceBar>

<ReadingProgress element={contentElement} />

<PageContent noPad bind:element={contentElement} class="bg-surface flex flex-col !gap-0">
  {#if $event && $article}
    <!-- PageContent is the scroll container and has a definite height, so a flex row placed
         directly in it would size its columns to one viewport. This wrapper is sized by its
         content instead, which lets the column/sidebar divider run the whole way down. -->
    <div class="flex min-h-full shrink-0 flex-col lg:flex-row">
      <div class="flex min-w-0 grow flex-col lg:border-r" style="border-color: var(--line)">
        <article class="flex flex-col">
          <div class="flex flex-col px-5 sm:px-8">
            <header class="mx-auto flex w-full max-w-[68ch] flex-col gap-4 pt-8 sm:pt-12">
              <h2 class="text-3xl leading-[1.15] font-bold text-balance sm:text-5xl">
                {$article.title() || "Untitled"}
              </h2>
              {#if $article.summary()}
                <p class="text-content-muted text-lg leading-snug text-pretty sm:text-xl">
                  {$article.summary()}
                </p>
              {/if}
              <div class="flex flex-wrap items-center gap-x-4 gap-y-2 pt-2">
                <Profile pubkey={$event.pubkey} {url} />
                <span class="text-content-subtle text-sm">
                  {formatTimestamp($article.publishedAt())} · {displayReadingTime($event.content)}
                </span>
              </div>
            </header>
            {#if $article.image()}
              <img
                src={$article.image()}
                alt=""
                class="mx-auto mt-8 max-h-[24rem] w-full max-w-[76ch] rounded-2xl object-cover" />
            {/if}
            <div class="mx-auto flex w-full max-w-[68ch] flex-col gap-6 py-8">
              <ContentMarkdown
                event={$event}
                {url}
                class="content-markdown--article {$article.summary()
                  ? ''
                  : 'content-markdown--lead'}" />
            </div>
          </div>
          {#if topics.length > 0}
            <div class="border-t px-5 py-6 sm:px-8" style="border-color: var(--line)">
              <div class="mx-auto flex w-full max-w-[68ch] flex-wrap gap-2">
                {#each topics as topic (topic)}
                  <span class="button button-neutral button-xs rounded-full font-normal">
                    #{topic}
                  </span>
                {/each}
              </div>
            </div>
          {/if}
        </article>
        <div class="border-t px-5 py-4 sm:px-8" style="border-color: var(--line)">
          <div class="mx-auto flex w-full max-w-[68ch]">
            <ArticleActions event={$event} {url} {context} showActivity detail />
          </div>
        </div>
        <!-- lg carries this in the sidebar instead, which sits below the comments here. -->
        <div class="border-t px-5 py-6 sm:px-8 lg:hidden" style="border-color: var(--line)">
          <div class="mx-auto flex w-full max-w-[68ch] flex-col gap-2">
            <p class="text-content-subtle text-xs font-bold tracking-wide uppercase">Written by</p>
            <Profile pubkey={$event.pubkey} {url} />
          </div>
        </div>
        <div class="border-t" style="border-color: var(--line)">
          <EventComments event={$event} {url} {context} />
        </div>
      </div>
      <ArticleAuthorSidebar {url} event={$event} />
    </div>
  {:else}
    <div class="flex grow justify-center py-20">
      {#await sleep(5000)}
        <Spinner loading>Loading article...</Spinner>
      {:then}
        <p>Failed to load article.</p>
      {/await}
    </div>
  {/if}
</PageContent>
