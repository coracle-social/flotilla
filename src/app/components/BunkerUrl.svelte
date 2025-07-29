<script lang="ts">
  import {debounce} from "throttle-debounce"
  import Scanner from "@lib/components/Scanner.svelte"
  import Button from "@lib/components/Button.svelte"
  import Field from "@lib/components/Field.svelte"
  import Icon from "@lib/components/Icon.svelte"
  import InfoBunker from "@app/components/InfoBunker.svelte"
  import type {Nip46Controller} from "@app/nip46"
  import {pushModal} from "@app/modal"

  type Props = {
    controller: Nip46Controller
  }

  const {controller}: Props = $props()
  const {loading, bunker} = controller

  const toggleScanner = () => {
    showScanner = !showScanner
  }

  const onScan = debounce(1000, async (data: string) => {
    showScanner = false
    $bunker = data
  })

  let showScanner = $state(false)
</script>

<Field>
  {#snippet label()}
    <p>Bunker Link*</p>
  {/snippet}
  {#snippet input()}
    <label class="input input-bordered flex w-full items-center gap-2">
      <Icon icon="cpu" />
      <input disabled={$loading} bind:value={$bunker} class="grow" placeholder="bunker://" />
      <Button onclick={toggleScanner}>
        <Icon icon="qr-code" />
      </Button>
    </label>
  {/snippet}
  {#snippet info()}
    <p>
      A login link provided by a nostr signing app.
      <Button class="link" onclick={() => pushModal(InfoBunker)}>What is a bunker link?</Button>
    </p>
  {/snippet}
</Field>
{#if showScanner}
  <Scanner onscan={onScan} />
{/if}
