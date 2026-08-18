<script lang="ts">
  import {onDestroy, onMount} from "svelte"
  import {readable} from "svelte/store"
  import type {Readable} from "svelte/store"
  import {page} from "$app/stores"
  import {goto} from "$app/navigation"
  import {sortBy, partition, spec, max, pushToMapKey} from "@welshman/lib"
  import type {Maybe} from "@welshman/lib"
  import type {TrustedEvent} from "@welshman/util"
  import {LONG_FORM, getAddress, tagSpec, tagValue} from "@welshman/util"
  import {Article} from "@welshman/domain"
  import {fly} from "@lib/transition"
  import DocumentText from "@assets/icons/document-text.svg?dataurl"
  import Add from "@assets/icons/add.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import PageContent from "@lib/components/PageContent.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import SpaceBar from "@app/components/SpaceBar.svelte"
  import ArticleItem from "@app/components/ArticleItem.svelte"
  import ArticleSidebar from "@app/components/ArticleSidebar.svelte"
  import {reader} from "@app/core"
  import {decodeRelay} from "@app/relays"
  import {makeCommentFilter} from "@app/content"
  import {isFeedLoading, makeFeed, makeFeedContext, makeScrollLoader} from "@app/feeds"
  import {makeArticleCreatePath} from "@app/routes"

  const url = decodeRelay($page.params.relay!)
  const context = makeFeedContext({relays: [url]})

  onDestroy(context.cleanup)

  let older: Maybe<ReturnType<typeof makeScrollLoader>> = $state()

  const loading = $derived(isFeedLoading($older))
  const exhausted = $derived($older?.status === "exhausted")
  let author: string | undefined = $state()
  let topic: string | undefined = $state()
  let element: HTMLElement | undefined = $state()
  let events: Readable<TrustedEvent[]> = $state(readable([]))

  const createArticle = () => goto(makeArticleCreatePath(url))

  const articles = $derived.by(() => {
    const scores = new Map<string, number[]>()
    const [items, comments] = partition(spec({kind: LONG_FORM}), $events)

    for (const comment of comments) {
      const address = tagValue(tagSpec("A"), comment.tags)

      if (address) {
        pushToMapKey(scores, address, comment.created_at)
      }
    }

    return sortBy(e => -max([...(scores.get(getAddress(e)) || []), e.created_at]), items)
  })

  const filtered = $derived(
    articles.filter(
      e =>
        (!author || e.pubkey === author) && (!topic || reader(Article)(e).topics().includes(topic)),
    ),
  )

  onMount(() => {
    const feed = makeFeed({
      relays: [url],
      onEvent: context.add,
      filters: [{kinds: [LONG_FORM]}, makeCommentFilter([LONG_FORM])],
    })

    events = feed.events

    // These lists are sorted newest first, so reaching the bottom is reaching the oldest thing
    // loaded.
    older = makeScrollLoader(element!, feed.loadOlder)

    return () => {
      older?.stop()
      feed.cleanup()
    }
  })
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
        <ArticleItem {url} {event} {context} />
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
  <ArticleSidebar {url} events={articles} bind:author bind:topic />
</PageContent>
