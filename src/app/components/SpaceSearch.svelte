<script lang="ts">
  import {MESSAGE, displayRelayUrl, tagSpec, tagValue} from "@welshman/util"
  import Modal from "@lib/components/Modal.svelte"
  import ModalHeader from "@lib/components/ModalHeader.svelte"
  import ModalTitle from "@lib/components/ModalTitle.svelte"
  import ModalSubtitle from "@lib/components/ModalSubtitle.svelte"
  import RoomName from "@app/components/RoomName.svelte"
  import SearchBody from "@app/components/SearchBody.svelte"
  import {CONTENT_KINDS} from "@app/features/content"
  import {relayMemberLists} from "@app/core/plugins"

  type Props = {
    url: string
  }

  const {url}: Props = $props()

  const filter = {kinds: [MESSAGE, ...CONTENT_KINDS]}

  const members = $relayMemberLists.forUrl(url)
</script>

<Modal class="flex flex-col gap-2">
  <ModalHeader>
    <ModalTitle>Search</ModalTitle>
    <ModalSubtitle>
      on <span class="text-primary">{displayRelayUrl(url)}</span>
    </ModalSubtitle>
  </ModalHeader>
  <SearchBody
    {url}
    {filter}
    placeholder="Search this space..."
    relays={[url]}
    members={$members?.pubkeys() ?? []}>
    {#snippet badges(event)}
      {@const h = tagValue(tagSpec("h"), event.tags)}
      {#if h}
        <span class="badge badge-neutral">
          <RoomName {url} {h} />
        </span>
      {/if}
    {/snippet}
  </SearchBody>
</Modal>
