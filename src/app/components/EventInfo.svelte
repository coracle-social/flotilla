<script lang="ts">
  import {onMount} from "svelte"
  import * as nip19 from "nostr-tools/nip19"
  import {LOCALE, secondsToDate} from "@welshman/lib"
  import type {TrustedEvent} from "@welshman/util"
  import {displayRelayUrl, seen, toNostrURI} from "@welshman/util"
  import FileText from "@assets/icons/file-text.svg?dataurl"
  import Copy from "@assets/icons/copy.svg?dataurl"
  import UserCircle from "@assets/icons/user-circle.svg?dataurl"
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

  const seenOn = $app.tracker.getRelays(event.id)
  const npub1 = nip19.npubEncode(event.pubkey)
  const json = JSON.stringify(event, null, 2)
  const copyLink = () => clip(nevent1)
  const copyPubkey = () => clip(npub1)
  const copyJson = () => clip(json)
  const back = () => history.back()

  const formatter = new Intl.DateTimeFormat(LOCALE, {
    dateStyle: "long",
    timeStyle: "long",
  })

  let nevent1 = $state("")

  onMount(async () => {
    const relays = url ? [url] : await $router.resolver.relays([seen(event)])

    nevent1 = toNostrURI(nip19.neventEncode({...event, relays}))
  })
</script>

<Modal>
  <ModalBody>
    <ModalHeader>
      <ModalTitle>Event Details</ModalTitle>
      <ModalSubtitle>The full details of this event are shown below.</ModalSubtitle>
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
        <p>Event Link</p>
      {/snippet}
      {#snippet input()}
        <label class="input flex w-full items-center gap-2">
          <Icon icon={FileText} />
          <input type="text" class="truncate min-w-0 grow" value={nevent1} />
          <Button onclick={copyLink} class="flex items-center">
            <Icon icon={Copy} />
          </Button>
        </label>
      {/snippet}
    </FieldInline>
    <FieldInline>
      {#snippet label()}
        <p>Author Pubkey</p>
      {/snippet}
      {#snippet input()}
        <label class="input flex w-full items-center gap-2">
          <Icon icon={UserCircle} />
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
            {#each seenOn as url, i (url)}
              <Badge class="bg-surface flex gap-1">
                <span>{displayRelayUrl(url)}</span>
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
