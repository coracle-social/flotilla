<script lang="ts">
  import {onDestroy} from "svelte"
  import cx from "classnames"
  import {derived} from "svelte/store"
  import {formatTimestampAsDate, uniq} from "@welshman/lib"
  import {Article} from "@welshman/domain"
  import Link from "@lib/components/Link.svelte"
  import PageContent from "@lib/components/PageContent.svelte"
  import LoadingFallback from "@lib/components/LoadingFallback.svelte"
  import MenuButton from "@lib/components/MenuButton.svelte"
  import Button from "@lib/components/Button.svelte"
  import SpaceBar from "@app/components/SpaceBar.svelte"
  import ContentMarkdown from "@app/components/ContentMarkdown.svelte"
  import Profile from "@app/components/Profile.svelte"
  import ProfileCircle from "@app/components/ProfileCircle.svelte"
  import ProfileName from "@app/components/ProfileName.svelte"
  import ProfileDetail from "@app/components/ProfileDetail.svelte"
  import RoomName from "@app/components/RoomName.svelte"
  import ArticleActionBar from "@app/components/ArticleActionBar.svelte"
  import ArticleAuthorSidebar from "@app/components/ArticleAuthorSidebar.svelte"
  import EventComments from "@app/components/EventComments.svelte"
  import EventMenu from "@app/components/EventMenu.svelte"
  import ReadingProgress from "@app/components/ReadingProgress.svelte"
  import {events} from "@app/core/plugins"
  import {reader} from "@app/core/domain"
  import {makeFeedContext} from "@app/features/feeds"
  import {displayReadingTime} from "@app/features/spaces/articles"
  import * as pages from "@app/navigation/pages"
  import {pushModal} from "@app/navigation/dialogs"

  type Props = {
    address: string
    relays: string[]
    url?: string
  }

  const {address, relays, url}: Props = $props()

  const context = makeFeedContext({relays: url ? [url] : undefined})
  const event = $events.one(address, relays).$
  const article = derived(event, $event => ($event ? reader(Article)($event) : undefined))
  const h = $derived($article?.room())
  const topics = $derived(uniq($article?.topics() ?? []))

  const back = () => history.back()

  const openAuthor = () => {
    if ($event) {
      pushModal(ProfileDetail, {pubkey: $event.pubkey, url})
    }
  }

  let contentElement = $state<Element>()

  onDestroy(context.cleanup)
</script>

<SpaceBar {back} class="!h-auto min-h-20 py-3">
  {#snippet title()}
    <div class="flex min-w-0 flex-col gap-0.5">
      <h1 class="truncate min-w-0 font-bold sm:text-xl">{$article?.title() ?? ""}</h1>
      {#if $article && url && h}
        <p class="text-xs opacity-75">
          <Link href={pages.room.path({url, h})} class="link">#<RoomName {url} {h} /></Link>
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

<PageContent noPad bind:element={contentElement} class="@container bg-surface flex flex-col !gap-0">
  {#if $event && $article}
    <!-- PageContent is the scroll container and has a definite height, so a flex row placed
         directly in it would size its columns to one viewport. This wrapper is sized by its
         content instead, which lets the column/sidebar divider run the whole way down. -->
    <div class="flex min-h-full shrink-0 flex-col @2xl:flex-row">
      <div class={cx("flex min-w-0 grow flex-col border-line", url && "@2xl:border-r")}>
        <article class="flex flex-col">
          <div class="flex flex-col px-5 sm:px-8">
            <header class="mx-auto flex w-full max-w-[68ch] flex-col gap-3 pt-8 sm:pt-12">
              <h2 class="text-3xl leading-tight font-bold text-balance sm:text-4xl">
                {$article.title() || "Untitled"}
              </h2>
              {#if $article.summary()}
                <p class="text-content-muted text-lg leading-snug text-pretty sm:text-xl">
                  {$article.summary()}
                </p>
              {/if}
              <div class="flex items-center gap-3 pt-3">
                <Button onclick={openAuthor} class="shrink-0">
                  <ProfileCircle pubkey={$event.pubkey} {url} size={10} />
                </Button>
                <div class="flex min-w-0 flex-col gap-0.5 leading-tight">
                  <Button onclick={openAuthor} class="truncate text-left text-sm font-bold">
                    <ProfileName pubkey={$event.pubkey} {url} />
                  </Button>
                  <span class="text-content-subtle text-sm">
                    {formatTimestampAsDate($article.publishedAt())} · {displayReadingTime(
                      $event.content,
                    )}
                  </span>
                </div>
              </div>
            </header>
            {#if $article.image()}
              <img
                src={$article.image()}
                alt=""
                class="mx-auto mt-8 max-h-[24rem] w-full max-w-[76ch] rounded-2xl object-cover" />
            {/if}
            <div class="mx-auto flex w-full max-w-[68ch] flex-col gap-6 pt-6 pb-8">
              <ContentMarkdown
                event={$event}
                {url}
                class="content-markdown--article {$article.summary()
                  ? ''
                  : 'content-markdown--lead'}" />
            </div>
          </div>
          {#if topics.length > 0}
            <div class="border-t px-5 py-6 sm:px-8 border-line">
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
        <div class="border-t px-5 py-4 sm:px-8 border-line">
          <div class="mx-auto flex w-full max-w-[68ch]">
            <ArticleActionBar event={$event} {url} {context} />
          </div>
        </div>
        <!-- The sidebar carries this on a wide space page; without one it shows here instead. -->
        <div class={cx("border-t px-5 py-6 sm:px-8 border-line", url && "@2xl:hidden")}>
          <div class="mx-auto flex w-full max-w-[68ch] flex-col gap-2">
            <p class="text-content-subtle text-xs font-bold tracking-wide uppercase">Written by</p>
            <Profile pubkey={$event.pubkey} {url} />
          </div>
        </div>
        <div class="border-t border-line">
          <EventComments
            event={$event}
            {url}
            {relays}
            {context}
            columnClass="mx-auto max-w-[68ch]" />
        </div>
      </div>
      {#if url}
        <ArticleAuthorSidebar {url} event={$event} />
      {/if}
    </div>
  {:else}
    <LoadingFallback
      class="grow"
      loadingMessage="Loading article..."
      failureMessage="Failed to load article." />
  {/if}
</PageContent>
