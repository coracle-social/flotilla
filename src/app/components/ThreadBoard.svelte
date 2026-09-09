<script lang="ts">
  import type {TrustedEvent} from "@welshman/util"
  import Add from "@assets/icons/add.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import RoomNameWithImage from "@app/components/RoomNameWithImage.svelte"
  import ThreadBoardItem from "@app/components/ThreadBoardItem.svelte"
  import ThreadCreate from "@app/components/ThreadCreate.svelte"
  import type {FeedContext} from "@app/feeds"
  import {pushModal} from "@app/modal"

  type Props = {
    url: string
    h: string
    threads: TrustedEvent[]
    context: FeedContext
  }

  const {url, h, threads, context}: Props = $props()

  let width = $state(0)

  const createThread = () => pushModal(ThreadCreate, {url, h})
</script>

<section bind:clientWidth={width} class="card card-flat p-0">
  <header
    class="flex items-center justify-between gap-2 border-b border-solid border-line px-4 py-3">
    <h2 class="text-lg">
      {#if h}
        <RoomNameWithImage {url} {h} />
      {:else}
        General
      {/if}
    </h2>
    <div class="flex shrink-0 items-center gap-3">
      <span class="text-content-muted text-sm">
        {threads.length}
        {threads.length === 1 ? "Topic" : "Topics"}
      </span>
      <Button class="button button-primary button-sm" onclick={createThread}>
        <Icon icon={Add} />
        Create
      </Button>
    </div>
  </header>
  {#if threads.length === 0}
    <p class="text-content-muted p-4 text-sm">No topics yet.</p>
  {:else}
    <div class="pb-4">
      {#if width >= 640}
        <table class="w-full border-collapse">
          <thead
            class="border-b border-solid border-line bg-surface-less text-xs font-bold uppercase tracking-wide text-content-muted">
            <tr>
              <th class="px-4 py-3 text-left">Topic</th>
              <th class="w-32 px-4 py-3 text-left">Author</th>
              <th class="w-20 px-4 py-3 text-center">Replies</th>
              <th class="w-32 px-4 py-3 text-right">Last post</th>
            </tr>
          </thead>
          <tbody>
            {#each threads as event (event.id)}
              <ThreadBoardItem {url} {event} {context} />
            {/each}
          </tbody>
        </table>
      {:else}
        {#each threads as event (event.id)}
          <ThreadBoardItem stacked {url} {event} {context} />
        {/each}
      {/if}
    </div>
  {/if}
</section>
