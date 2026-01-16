<script lang="ts">
  import {onMount} from "svelte"
  import {
    pubkey,
    getRelayLists,
    derivePubkeyRelays,
    addRelay,
    removeRelay,
    addBlockedRelay,
    removeBlockedRelay,
    addMessagingRelay,
    removeMessagingRelay,
  } from "@welshman/app"
  import {RelayMode} from "@welshman/util"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import Collapse from "@lib/components/Collapse.svelte"
  import RelayItem from "@app/components/RelayItem.svelte"
  import RelayAdd from "@app/components/RelayAdd.svelte"
  import {pushModal} from "@app/util/modal"
  import {discoverRelays} from "@app/core/requests"
  import Globus from "@assets/icons/globus.svg?dataurl"
  import Inbox from "@assets/icons/inbox.svg?dataurl"
  import Mailbox from "@assets/icons/mailbox.svg?dataurl"
  import ForbiddenCircle from "@assets/icons/forbidden-circle.svg?dataurl"
  import CloseCircle from "@assets/icons/close-circle.svg?dataurl"
  import AddCircle from "@assets/icons/add-circle.svg?dataurl"

  const readRelayUrls = derivePubkeyRelays($pubkey!, RelayMode.Read)
  const writeRelayUrls = derivePubkeyRelays($pubkey!, RelayMode.Write)
  const blockedRelayUrls = derivePubkeyRelays($pubkey!, RelayMode.Blocked)
  const messagingRelayUrls = derivePubkeyRelays($pubkey!, RelayMode.Messaging)

  const addReadRelays = () =>
    pushModal(RelayAdd, {
      relays: readRelayUrls,
      addRelay: (url: string) => addRelay(url, RelayMode.Read),
    })

  const addWriteRelays = () =>
    pushModal(RelayAdd, {
      relays: writeRelayUrls,
      addRelay: (url: string) => addRelay(url, RelayMode.Write),
    })

  const addBlockedRelays = () =>
    pushModal(RelayAdd, {relays: blockedRelayUrls, addRelay: addBlockedRelay})

  const addMessagingRelays = () =>
    pushModal(RelayAdd, {relays: messagingRelayUrls, addRelay: addMessagingRelay})

  const removeReadRelay = (url: string) => removeRelay(url, RelayMode.Read)

  const removeWriteRelay = (url: string) => removeRelay(url, RelayMode.Write)

  onMount(() => {
    discoverRelays(getRelayLists())
  })
</script>

<div class="content column gap-4">
  <Collapse class="card2 bg-alt column gap-4 shadow-md">
    {#snippet title()}
      <h2 class="flex items-center gap-3 text-xl">
        <Icon icon={Globus} />
        Outbox Relays
      </h2>
    {/snippet}
    {#snippet description()}
      <p class="text-sm">
        These relays will be advertised on your profile as places where you send your public notes.
        Be sure to select relays that will accept your notes, and which will let people who follow
        you read them.
      </p>
    {/snippet}
    <div class="column gap-2">
      {#each $writeRelayUrls.sort() as url (url)}
        <RelayItem {url}>
          <Button
            class="tooltip flex items-center"
            data-tip="Stop using this relay"
            onclick={() => removeWriteRelay(url)}>
            <Icon icon={CloseCircle} />
          </Button>
        </RelayItem>
      {:else}
        <p class="text-center text-sm">No relays found</p>
      {/each}
      <Button class="btn btn-primary mt-2" onclick={addWriteRelays}>
        <Icon icon={AddCircle} />
        Add Relay
      </Button>
    </div>
  </Collapse>
  <Collapse class="card2 bg-alt column gap-4 shadow-md">
    {#snippet title()}
      <h2 class="flex items-center gap-3 text-xl">
        <Icon icon={Inbox} />
        Inbox Relays
      </h2>
    {/snippet}
    {#snippet description()}
      <p class="text-sm">
        These relays will be advertised on your profile as places where other people should send
        notes intended for you. Be sure to select relays that will accept notes that tag you.
      </p>
    {/snippet}
    <div class="column gap-2">
      {#each $readRelayUrls.sort() as url (url)}
        <RelayItem {url}>
          <Button
            class="tooltip flex items-center"
            data-tip="Stop using this relay"
            onclick={() => removeReadRelay(url)}>
            <Icon icon={CloseCircle} />
          </Button>
        </RelayItem>
      {:else}
        <p class="text-center text-sm">No relays found</p>
      {/each}
      <Button class="btn btn-primary mt-2" onclick={addReadRelays}>
        <Icon icon={AddCircle} />
        Add Relay
      </Button>
    </div>
  </Collapse>
  <Collapse class="card2 bg-alt column gap-4 shadow-md">
    {#snippet title()}
      <h2 class="flex items-center gap-3 text-xl">
        <Icon icon={Mailbox} />
        Messaging Relays
      </h2>
    {/snippet}
    {#snippet description()}
      <p class="text-sm">
        These relays will be advertised on your profile as places you use to send and receive direct
        messages. Be sure to select relays that will accept your messages and messages from people
        you'd like to be in contact with.
      </p>
    {/snippet}
    <div class="column gap-2">
      {#each $messagingRelayUrls.sort() as url (url)}
        <RelayItem {url}>
          <Button
            class="tooltip flex items-center"
            data-tip="Stop using this relay"
            onclick={() => removeMessagingRelay(url)}>
            <Icon icon={CloseCircle} />
          </Button>
        </RelayItem>
      {:else}
        <p class="text-center text-sm">No relays found</p>
      {/each}
      <Button class="btn btn-primary mt-2" onclick={addMessagingRelays}>
        <Icon icon={AddCircle} />
        Add Relay
      </Button>
    </div>
  </Collapse>
  <Collapse class="card2 bg-alt column gap-4 shadow-md">
    {#snippet title()}
      <h2 class="flex items-center gap-3 text-xl">
        <Icon icon={ForbiddenCircle} />
        Blocked Relays
      </h2>
    {/snippet}
    {#snippet description()}
      <p class="text-sm">
        These relays will never be connected to by clients supporting this policy.
      </p>
    {/snippet}
    <div class="column gap-2">
      {#each $blockedRelayUrls.sort() as url (url)}
        <RelayItem {url}>
          <Button
            class="tooltip flex items-center"
            data-tip="Stop using this relay"
            onclick={() => removeBlockedRelay(url)}>
            <Icon icon={CloseCircle} />
          </Button>
        </RelayItem>
      {:else}
        <p class="text-center text-sm">No relays found</p>
      {/each}
      <Button class="btn btn-primary mt-2" onclick={addBlockedRelays}>
        <Icon icon={AddCircle} />
        Add Relay
      </Button>
    </div>
  </Collapse>
</div>
