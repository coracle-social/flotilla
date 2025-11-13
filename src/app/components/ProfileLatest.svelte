<script lang="ts">
  import type {Snippet} from "svelte"
  import {load} from "@welshman/net"
  import {NOTE} from "@welshman/util"
  import NoteItem from "@app/components/NoteItem.svelte"

  interface Props {
    url: string
    pubkey: string
    limit?: number
    fallback?: Snippet
  }

  const {url, pubkey, limit = 1, fallback}: Props = $props()

  const events = load({
    relays: [url],
    filters: [{authors: [pubkey], kinds: [NOTE], limit}],
  })
</script>

<div class="col-4">
  <div class="flex flex-col gap-2">
    {#await events}
      <p class="center flex min-h-6">
        <span class="loading loading-spinner"></span>
      </p>
    {:then events}
      {#each events as event (event.id)}
        <NoteItem {url} {event} />
      {:else}
        <div class="min-h-6">
          {@render fallback?.()}
        </div>
      {/each}
    {/await}
  </div>
</div>
