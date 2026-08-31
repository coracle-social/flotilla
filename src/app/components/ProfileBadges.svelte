<script lang="ts">
  import {onMount} from "svelte"
  import {formatTimestampRelative} from "@welshman/lib"
  import {NOTE, COMMENT, MESSAGE} from "@welshman/util"
  import Button from "@lib/components/Button.svelte"
  import ProfileSpaces from "@app/components/ProfileSpaces.svelte"
  import {network, roomLists} from "@app/core"
  import {deriveLatestEvent} from "@app/repository"
  import {goToEvent} from "@app/routes"
  import {pushModal} from "@app/modal"

  type Props = {
    pubkey: string
    url?: string
  }

  const {pubkey, url}: Props = $props()

  const latest = deriveLatestEvent(pubkey)

  const spaceUrls = $roomLists.urls(pubkey).$

  const viewEvent = () => goToEvent($latest!)

  const openSpaces = () => pushModal(ProfileSpaces, {pubkey, url})

  onMount(() => {
    $network.loadUsingOutbox(pubkey, {limit: 1, kinds: [NOTE, COMMENT, MESSAGE]})
  })
</script>

<div class="flex flex-wrap gap-2">
  {#if $latest}
    <Button onclick={viewEvent} class="badge badge-neutral">
      Last active {formatTimestampRelative($latest.created_at)}
    </Button>
  {/if}
  {#if $spaceUrls.length > 0}
    <Button onclick={openSpaces} class="badge badge-neutral">
      {$spaceUrls.length}
      {$spaceUrls.length === 1 ? "space" : "spaces"}
    </Button>
  {/if}
</div>
