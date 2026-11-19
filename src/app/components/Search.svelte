<script lang="ts">
  import {MESSAGE} from "@welshman/util"
  import type {TrustedEvent} from "@welshman/util"
  import {publish} from "@welshman/app"
  import Server from "@assets/icons/server.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import Modal from "@lib/components/Modal.svelte"
  import ModalHeader from "@lib/components/ModalHeader.svelte"
  import ModalTitle from "@lib/components/ModalTitle.svelte"
  import ModalSubtitle from "@lib/components/ModalSubtitle.svelte"
  import RelayList from "@app/components/RelayList.svelte"
  import RelayName from "@app/components/RelayName.svelte"
  import SearchBody from "@app/components/SearchBody.svelte"
  import {CONTENT_KINDS} from "@app/tools/content"
  import {app} from "@app/core/app"
  import {
    activeSpaceUrls,
    requireUser,
    user,
    userSearchRelayUrls,
    userSpaceUrls,
  } from "@app/core/user"
  import {relays, searchRelayLists} from "@app/core/plugins"
  import {HIDE_NOSTR} from "@app/core/env"
  import {pushModal} from "@app/navigation/dialogs"

  const filter = {kinds: [MESSAGE, ...CONTENT_KINDS]}

  // A visitor searches the spaces their nav lists.
  const spaceUrls = $derived($user ? $userSpaceUrls : $activeSpaceUrls)

  const getSpaceUrl = (event: TrustedEvent) =>
    spaceUrls.find(url => $app.repository.tracker.getRelays(event.id).has(url))

  const showRelays = () =>
    pushModal(RelayList, {
      title: "Search Relays",
      subtitle: "Relays that support searching for profiles and public notes.",
      relays: $searchRelayLists.urls(requireUser().pubkey).$,
      addRelay: (url: string) => $searchRelayLists.addUrl(url).then(publish),
      removeRelay: (url: string) => $searchRelayLists.removeUrl(url).then(publish),
      matchRelay: (url: string) => Boolean($relays.get(url)?.hasNip(50)),
    })
</script>

<Modal class="flex flex-col gap-2">
  <ModalHeader>
    <ModalTitle>Search</ModalTitle>
    <ModalSubtitle>
      {#if $user}
        across all your spaces
      {:else}
        across suggested spaces
      {/if}
    </ModalSubtitle>
  </ModalHeader>
  <SearchBody placeholder="Search spaces..." relays={spaceUrls} {filter}>
    {#snippet empty()}
      {@const spaces = spaceUrls.length}
      {@const extras = $userSearchRelayUrls.length}
      <div class="flex flex-col items-center gap-2 py-12 text-center">
        <p class="text-content-muted text-sm">
          Searching {spaces}
          {spaces === 1 ? "space" : "spaces"}{#if extras > 0 && !HIDE_NOSTR}, plus {extras}
            extra {extras === 1 ? "relay" : "relays"} for people{/if}.
        </p>
        {#if $user && !HIDE_NOSTR}
          <Button class="button button-link button-sm" onclick={showRelays}>
            <Icon size={4} icon={Server} />
            Manage search relays
          </Button>
        {/if}
      </div>
    {/snippet}
    {#snippet badges(event)}
      {@const url = getSpaceUrl(event)}
      {#if url}
        <span class="badge badge-neutral">
          <RelayName {url} />
        </span>
      {/if}
    {/snippet}
  </SearchBody>
</Modal>
