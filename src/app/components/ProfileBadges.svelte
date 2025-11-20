<script lang="ts">
  import {onMount} from "svelte"
  import {load} from "@welshman/net"
  import {Router} from "@welshman/router"
  import type {Filter} from "@welshman/util"
  import {deriveEvents} from "@welshman/store"
  import {formatTimestampRelative} from "@welshman/lib"
  import {NOTE, ROOMS, COMMENT} from "@welshman/util"
  import {repository, loadRelayList} from "@welshman/app"
  import Button from "@lib/components/Button.svelte"
  import ProfileSpaces from "@app/components/ProfileSpaces.svelte"
  import {deriveGroupList, getSpaceUrlsFromGroupLists, MESSAGE_KINDS} from "@app/core/state"
  import {goToEvent} from "@app/util/routes"
  import {pushModal} from "@app/util/modal"

  type Props = {
    pubkey: string
    url?: string
  }

  const {pubkey, url}: Props = $props()
  const filters: Filter[] = [{authors: [pubkey], limit: 1}]
  const events = deriveEvents(repository, {filters})
  const groupList = deriveGroupList(pubkey)
  const spaceUrls = $derived(getSpaceUrlsFromGroupList($groupList))

  const viewEvent = () => goToEvent($events[0]!)

  const openSpaces = () => pushModal(ProfileSpaces, {pubkey, url})

  onMount(async () => {
    // Make sure we have their relay selections before we load their posts
    await loadRelayList(pubkey)

    // Load groups and at least one note, regardless of time frame
    load({
      filters: [
        {authors: [pubkey], kinds: [ROOMS]},
        {authors: [pubkey], limit: 1, kinds: [NOTE, COMMENT, ...MESSAGE_KINDS]},
      ],
      relays: Router.get().FromPubkeys([pubkey]).getUrls(),
    })
  })
</script>

<div class="flex flex-wrap gap-2">
  {#if $events.length > 0}
    <Button onclick={viewEvent} class="badge badge-neutral">
      Last active {formatTimestampRelative($events[0].created_at)}
    </Button>
  {/if}
  {#if spaceUrls.length > 0}
    <Button onclick={openSpaces} class="badge badge-neutral">
      {spaceUrls.length}
      {spaceUrls.length === 1 ? "space" : "spaces"}
    </Button>
  {/if}
</div>
