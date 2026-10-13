<script lang="ts">
  import {page} from "$app/stores"
  import ChatRound from "@assets/icons/chat-round.svg?dataurl"
  import Magnifier from "@assets/icons/magnifier.svg?dataurl"
  import Button from "@lib/components/Button.svelte"
  import Icon from "@lib/components/Icon.svelte"
  import SpaceBar from "@app/components/SpaceBar.svelte"
  import SpaceSearch from "@app/components/SpaceSearch.svelte"
  import RoomChat from "@app/components/RoomChat.svelte"
  import {decodeRelay} from "@app/core/relays"
  import {pushModal} from "@app/ui/modal"
  import type {PageProps} from "./$types"

  const {params}: PageProps = $props()

  const url = decodeRelay(params.relay)

  const showSpaceSearch = () => pushModal(SpaceSearch, {url})
</script>

<SpaceBar>
  {#snippet leading()}
    <Icon icon={ChatRound} />
  {/snippet}
  {#snippet title()}
    <strong>Chat</strong>
  {/snippet}
  {#snippet action()}
    <Button
      class="button button-neutral button-sm button-square"
      aria-label="Search"
      onclick={showSpaceSearch}>
      <Icon size={4} icon={Magnifier} />
    </Button>
  {/snippet}
</SpaceBar>

{#key [$page.url.searchParams.get("at"), $page.url.searchParams.get("event")].join()}
  <RoomChat {url} />
{/key}
