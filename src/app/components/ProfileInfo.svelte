<script lang="ts">
  import * as nip19 from "nostr-tools/nip19"
  import {onMount} from "svelte"
  import {call, LOCALE, secondsToDate} from "@welshman/lib"
  import type {TrustedEvent} from "@welshman/util"
  import {displayRelayUrl, outbox, toNostrURI} from "@welshman/util"
  import LinkRound from "@assets/icons/link-round.svg?dataurl"
  import Copy from "@assets/icons/copy.svg?dataurl"
  import UserId from "@assets/icons/user-id.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import FieldInline from "@lib/components/FieldInline.svelte"
  import Button from "@lib/components/Button.svelte"
  import Badge from "@lib/components/Badge.svelte"
  import Modal from "@lib/components/Modal.svelte"
  import ModalBody from "@lib/components/ModalBody.svelte"
  import ModalHeader from "@lib/components/ModalHeader.svelte"
  import ModalFooter from "@lib/components/ModalFooter.svelte"
  import ModalTitle from "@lib/components/ModalTitle.svelte"
  import ModalSubtitle from "@lib/components/ModalSubtitle.svelte"
  import {app, router} from "@app/core"
  import {clip} from "@app/toast"

  type Props = {
    url?: string
    event: TrustedEvent
  }

  const {url, event}: Props = $props()

  const npub1 = nip19.npubEncode(event.pubkey)
  const seenOn = $app.tracker.getRelays(event.id)
  const json = call(() => {
    try {
      return JSON.stringify(JSON.parse(event.content), null, 2)
    } catch {
      return event.content
    }
  })
  const copyLink = () => clip(nprofile1)
  const copyPubkey = () => clip(npub1)
  const copyJson = () => clip(json)
  const back = () => history.back()

  const formatter = new Intl.DateTimeFormat(LOCALE, {
    dateStyle: "long",
    timeStyle: "long",
  })

  let nprofile1 = $state("")

  onMount(async () => {
    const relays = url ? [url] : await $router.resolver.relays([outbox(event.pubkey)])

    nprofile1 = toNostrURI(nip19.nprofileEncode({pubkey: event.pubkey, relays}))
  })
</script>

<Modal>
  <ModalBody>
    <ModalHeader>
      <ModalTitle>Profile Details</ModalTitle>
      <ModalSubtitle>The full details of this profile are shown below.</ModalSubtitle>
    </ModalHeader>
    <FieldInline>
      {#snippet label()}
        <p>Created At</p>
      {/snippet}
      {#snippet input()}
        <p>{formatter.format(secondsToDate(event.created_at))}</p>
      {/snippet}
    </FieldInline>
    <FieldInline>
      {#snippet label()}
        <p>Profile Link</p>
      {/snippet}
      {#snippet input()}
        <label class="input flex w-full items-center gap-2">
          <Icon icon={LinkRound} />
          <input type="text" class="truncate min-w-0 grow" value={nprofile1} />
          <Button onclick={copyLink} class="flex items-center">
            <Icon icon={Copy} />
          </Button>
        </label>
      {/snippet}
    </FieldInline>
    <FieldInline>
      {#snippet label()}
        <p>Public Key</p>
      {/snippet}
      {#snippet input()}
        <label class="input flex w-full items-center gap-2">
          <Icon icon={UserId} />
          <input type="text" class="truncate min-w-0 grow" value={npub1} />
          <Button onclick={copyPubkey} class="flex items-center">
            <Icon icon={Copy} />
          </Button>
        </label>
      {/snippet}
    </FieldInline>
    {#if !url && seenOn.size > 0}
      <FieldInline>
        {#snippet label()}
          <p>Seen On</p>
        {/snippet}
        {#snippet input()}
          <div class="flex flex-wrap gap-2">
            {#each seenOn as seenUrl (seenUrl)}
              <Badge class="bg-surface flex gap-1">
                <span>{displayRelayUrl(seenUrl)}</span>
              </Badge>
            {/each}
          </div>
        {/snippet}
      </FieldInline>
    {/if}
    <div class="relative">
      <pre class="card card-sm overflow-auto text-xs"><code>{json}</code></pre>
      <p class="absolute right-2 top-2 flex grow items-center justify-between">
        <Button onclick={copyJson} class="button button-neutral button-sm flex items-center">
          <Icon icon={Copy} /> Copy
        </Button>
      </p>
    </div>
  </ModalBody>
  <ModalFooter>
    <Button class="button button-primary grow" onclick={back}>Got it</Button>
  </ModalFooter>
</Modal>
