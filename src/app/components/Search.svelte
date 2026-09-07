<script lang="ts">
  import {MESSAGE} from "@welshman/util"
  import type {TrustedEvent} from "@welshman/util"
  import Badge from "@lib/components/Badge.svelte"
  import Modal from "@lib/components/Modal.svelte"
  import ModalHeader from "@lib/components/ModalHeader.svelte"
  import ModalTitle from "@lib/components/ModalTitle.svelte"
  import ModalSubtitle from "@lib/components/ModalSubtitle.svelte"
  import RelayName from "@app/components/RelayName.svelte"
  import SearchBody from "@app/components/SearchBody.svelte"
  import {CONTENT_KINDS} from "@app/content"
  import {app} from "@app/core"
  import {userSpaceUrls} from "@app/rooms"

  const filter = {kinds: [MESSAGE, ...CONTENT_KINDS]}

  const getSpaceUrl = (event: TrustedEvent) =>
    $userSpaceUrls.find(url => $app.tracker.getRelays(event.id).has(url))
</script>

<Modal class="flex flex-col gap-2">
  <ModalHeader>
    <ModalTitle>Search</ModalTitle>
    <ModalSubtitle>across all your spaces</ModalSubtitle>
  </ModalHeader>
  <SearchBody placeholder="Search your spaces..." relays={$userSpaceUrls} {filter}>
    {#snippet badges(event)}
      {@const url = getSpaceUrl(event)}
      {#if url}
        <Badge variant="neutral">
          <RelayName {url} />
        </Badge>
      {/if}
    {/snippet}
  </SearchBody>
</Modal>
