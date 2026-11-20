<script lang="ts">
  import {onDestroy, onMount} from "svelte"
  import {spec} from "@welshman/lib"
  import {LONG_FORM, getAddress} from "@welshman/util"
  import {Article} from "@welshman/domain"
  import {fly} from "@lib/transition"
  import DocumentText from "@assets/icons/document-text.svg?dataurl"
  import Add from "@assets/icons/add.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import PageContent from "@lib/components/PageContent.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import {followScroll} from "@lib/pager"
  import SpaceBar from "@app/components/SpaceBar.svelte"
  import ArticleItem from "@app/components/ArticleItem.svelte"
  import ArticleSidebar from "@app/components/ArticleSidebar.svelte"
  import {reader} from "@app/core/domain"
  import {navigate} from "@app/navigation/navigate"
  import {sortArticles} from "@app/areas/spaces/articles"
  import {makeSpaceFeed} from "@app/tools/feeds/relay"
  import * as pages from "@app/navigation/pages"
  import {withLogin} from "@app/components/flows/login"
  import type {PageProps} from "./$types"

  const {params}: PageProps = $props()

  const {url} = pages.articles.decode(params)
  const feed = makeSpaceFeed(url, LONG_FORM)
  const {events} = feed
  const status = feed.older.status

  const loading = $derived($status === "loading")
  const exhausted = $derived($status === "exhausted")

  const createArticle = () =>
    withLogin("write an article", () => navigate(pages.articleCreate.path({url})))

  let author: string | undefined = $state()
  let topic: string | undefined = $state()
  let element: HTMLElement | undefined = $state()

  const articles = $derived(sortArticles($events.filter(spec({kind: LONG_FORM}))))

  const filtered = $derived(
    articles.filter(
      e =>
        (!author || e.pubkey === author) && (!topic || reader(Article)(e).topics().includes(topic)),
    ),
  )

  onMount(() => followScroll(element!, feed.older))

  onDestroy(feed.stop)
</script>

<SpaceBar>
  {#snippet leading()}
    <Icon icon={DocumentText} />
  {/snippet}
  {#snippet title()}
    <strong>Articles</strong>
  {/snippet}
  {#snippet action()}
    <Button class="button button-primary button-sm" onclick={createArticle}>
      <Icon icon={Add} />
      Write
    </Button>
  {/snippet}
</SpaceBar>

<PageContent bind:element class="flex flex-col gap-2 sm:gap-4 lg:flex-row lg:items-start !p-0">
  <div class="flex min-w-0 grow flex-col gap-2 sm:gap-4 p-2 sm:p-4 lg:pr-0">
    {#each filtered as event (getAddress(event))}
      <div in:fly>
        <ArticleItem {url} {event} />
      </div>
    {/each}
    <p class="flex h-10 items-center justify-center py-20">
      <Spinner {loading}>
        {#if loading}
          Looking for articles...
        {:else if exhausted && articles.length === 0}
          No articles found.
        {:else if filtered.length === 0}
          No articles match that filter.
        {:else if exhausted}
          That's all!
        {/if}
      </Spinner>
    </p>
  </div>
  <ArticleSidebar events={articles} bind:author bind:topic />
</PageContent>
