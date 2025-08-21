<script lang="ts">
  import * as nip19 from "nostr-tools/nip19"
  import {Router} from "@welshman/router"
  import {LOCALE, secondsToDate} from "@welshman/lib"
  import type {TrustedEvent} from "@welshman/util"
  import {displayRelayUrl} from "@welshman/util"
  import Icon from "@lib/components/Icon.svelte"
  import FieldInline from "@lib/components/FieldInline.svelte"
  import Button from "@lib/components/Button.svelte"
  import ModalHeader from "@lib/components/ModalHeader.svelte"
  import {trackerStore} from "@app/core/state"
  import {clip} from "@app/util/toast"

  type Props = {
    url?: string
    event: TrustedEvent
  }

  const {url, event}: Props = $props()

  const relays = url ? [url] : Router.get().Event(event).getUrls()
  const nevent1 = nip19.neventEncode({...event, relays})
  const seenOn = $trackerStore.getRelays(event.id)
  const npub1 = nip19.npubEncode(event.pubkey)
  const json = JSON.stringify(event, null, 2)
  const copyLink = () => clip(nevent1)
  const copyPubkey = () => clip(npub1)
  const copyJson = () => clip(json)

  const formatter = new Intl.DateTimeFormat(LOCALE, {
    dateStyle: "long",
    timeStyle: "long",
  })
</script>

<div class="column gap-4">
  <ModalHeader>
    {#snippet title()}
      <div>Event Details</div>
    {/snippet}
    {#snippet info()}
      <div>The full details of this event are shown below.</div>
    {/snippet}
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
      <label class="input input-bordered flex w-full items-center gap-2">
        <Icon icon="file" />
        <input type="text" class="ellipsize min-w-0 grow" value={nevent1} />
        <Button onclick={copyLink} class="flex items-center">
          <Icon icon="copy" />
        </Button>
      </label>
    {/snippet}
  </FieldInline>
  <FieldInline>
    {#snippet label()}
      <p>Author Pubkey</p>
    {/snippet}
    {#snippet input()}
      <label class="input input-bordered flex w-full items-center gap-2">
        <Icon icon="user-circle" />
        <input type="text" class="ellipsize min-w-0 grow" value={npub1} />
        <Button onclick={copyPubkey} class="flex items-center">
          <Icon icon="copy" />
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
            <span class="bg-alt badge flex gap-1">
              {displayRelayUrl(url)}
            </span>
          {/each}
        </div>
      {/snippet}
    </FieldInline>
  {/if}
  <div class="relative">
    <pre class="card2 card2-sm bg-alt overflow-auto text-xs"><code>{json}</code></pre>
    <p class="absolute right-2 top-2 flex flex-grow items-center justify-between">
      <Button onclick={copyJson} class="btn btn-neutral btn-sm flex items-center">
        <Icon icon="copy" /> Copy
      </Button>
    </p>
  </div>
  <Button class="btn btn-primary" onclick={() => history.back()}>Got it</Button>
</div>
