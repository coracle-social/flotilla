<script lang="ts">
  import {onMount} from "svelte"
  import {pubkey, getRelayLists, getMessagingRelayLists, derivePubkeyRelays} from "@welshman/app"
  import {RelayMode} from "@welshman/util"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import Collapse from "@lib/components/Collapse.svelte"
  import RelayItem from "@app/components/RelayItem.svelte"
  import RelayAdd from "@app/components/RelayAdd.svelte"
  import {pushModal} from "@app/util/modal"
  import {discoverRelays} from "@app/core/requests"
  import {setRelayPolicy, setMessagingRelayPolicy} from "@app/core/commands"
  import Globus from "@assets/icons/globus.svg?dataurl"
  import Inbox from "@assets/icons/inbox.svg?dataurl"
  import Mailbox from "@assets/icons/mailbox.svg?dataurl"
  import CloseCircle from "@assets/icons/close-circle.svg?dataurl"
  import AddCircle from "@assets/icons/add-circle.svg?dataurl"

  const readRelayUrls = derivePubkeyRelays($pubkey!, RelayMode.Read)
  const writeRelayUrls = derivePubkeyRelays($pubkey!, RelayMode.Write)
  const messagingRelayUrls = derivePubkeyRelays($pubkey!, RelayMode.Messaging)

  const addReadRelay = () =>
    pushModal(RelayAdd, {
      relays: readRelayUrls,
      addRelay: (url: string) => setRelayPolicy(url, true, $writeRelayUrls.includes(url)),
    })

  const addWriteRelay = () =>
    pushModal(RelayAdd, {
      relays: writeRelayUrls,
      addRelay: (url: string) => setRelayPolicy(url, $readRelayUrls.includes(url), true),
    })

  const addMessagingRelay = () =>
    pushModal(RelayAdd, {
      relays: messagingRelayUrls,
      addRelay: (url: string) => setMessagingRelayPolicy(url, true),
    })

  const removeReadRelay = (url: string) => setRelayPolicy(url, false, $writeRelayUrls.includes(url))

  const removeWriteRelay = (url: string) => setRelayPolicy(url, $readRelayUrls.includes(url), false)

  const removeMessagingRelay = (url: string) => setMessagingRelayPolicy(url, false)

  onMount(() => {
    discoverRelays([...getRelayLists(), ...getMessagingRelayLists()])
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
      <Button class="btn btn-primary mt-2" onclick={addWriteRelay}>
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
      <Button class="btn btn-primary mt-2" onclick={addReadRelay}>
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
      <Button class="btn btn-primary mt-2" onclick={addMessagingRelay}>
        <Icon icon={AddCircle} />
        Add Relay
      </Button>
    </div>
  </Collapse>
</div>
