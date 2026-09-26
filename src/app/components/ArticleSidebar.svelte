<script lang="ts">
  import cx from "classnames"
  import {countBy, identity, sortBy} from "@welshman/lib"
  import type {TrustedEvent} from "@welshman/util"
  import {Article} from "@welshman/domain"
  import Button from "@lib/components/Button.svelte"
  import ProfileCircle from "@app/components/ProfileCircle.svelte"
  import ProfileName from "@app/components/ProfileName.svelte"
  import {reader} from "@app/core"

  type Props = {
    url: string
    events: TrustedEvent[]
    author?: string
    topic?: string
  }

  let {url, events, author = $bindable(), topic = $bindable()}: Props = $props()

  const byCount = <T,>(counts: Map<T, number>) =>
    sortBy(([, count]) => -count, Array.from(counts.entries()))

  const authors = $derived(byCount(countBy(e => e.pubkey, events)))

  const topics = $derived(
    byCount(
      countBy(
        identity,
        events.flatMap(e => reader(Article)(e).topics()),
      ),
    ),
  )

  const selectAuthor = (pubkey: string) => () => {
    author = author === pubkey ? undefined : pubkey
  }

  const selectTopic = (name: string) => () => {
    topic = topic === name ? undefined : name
  }
</script>

<aside
  class="hidden w-64 shrink-0 flex-col gap-4 py-2 pr-2 sm:py-4 sm:pr-4 lg:sticky lg:top-0 lg:flex lg:max-h-full lg:overflow-y-auto">
  <section class="card card-sm flex flex-col gap-2">
    <h2 class="text-lg">Authors</h2>
    {#each authors as [pubkey, count] (pubkey)}
      <Button
        onclick={selectAuthor(pubkey)}
        class={cx("button button-xs w-full rounded-full font-normal", {
          "button-primary": pubkey === author,
        })}>
        <ProfileCircle {pubkey} {url} size={5} />
        <span class="min-w-0 grow truncate text-left">
          <ProfileName {pubkey} {url} />
        </span>
        <span class="opacity-75">{count}</span>
      </Button>
    {:else}
      <p class="text-sm opacity-75">No authors yet.</p>
    {/each}
  </section>
  {#if topics.length > 0}
    <section class="card card-sm flex flex-col gap-2">
      <h2 class="text-lg">Topics</h2>
      <div class="flex flex-wrap gap-2">
        {#each topics as [name, count] (name)}
          <Button
            onclick={selectTopic(name)}
            class={cx("button button-xs rounded-full font-normal", {
              "button-primary": name === topic,
            })}>
            #{name}
            <span class="opacity-75">{count}</span>
          </Button>
        {/each}
      </div>
    </section>
  {/if}
</aside>
