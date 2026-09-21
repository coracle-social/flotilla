<script lang="ts">
  import {onDestroy} from "svelte"
  import type {Snippet} from "svelte"
  import {NOTE} from "@welshman/util"
  import Spinner from "@lib/components/Spinner.svelte"
  import NoteItem from "@app/components/NoteItem.svelte"
  import {network} from "@app/core"
  import {makeFeedContext} from "@app/feeds"

  interface Props {
    url: string
    pubkey: string
    limit?: number
    fallback?: Snippet
  }

  const {url, pubkey, limit = 1, fallback}: Props = $props()

  const context = makeFeedContext({relays: [url]})

  onDestroy(context.cleanup)

  const events = $network.loadComplete({
    relays: [url],
    filters: [{authors: [pubkey], kinds: [NOTE], limit}],
  })
</script>

<div class="flex flex-col gap-4">
  <div class="flex flex-col gap-2">
    {#await events}
      <p class="flex justify-center items-center min-h-6">
        <Spinner />
      </p>
    {:then events}
      {#each events as event (event.id)}
        <NoteItem {url} {event} {context} />
      {:else}
        <div class="min-h-6">
          {@render fallback?.()}
        </div>
      {/each}
    {/await}
  </div>
</div>
