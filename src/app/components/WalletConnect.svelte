<script lang="ts">
  import {debounce} from "throttle-debounce"
  import {nwc} from "@getalby/sdk"
  import {sleep} from "@welshman/lib"
  import Link from "@lib/components/Link.svelte"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import Scanner from "@lib/components/Scanner.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import Field from "@lib/components/Field.svelte"
  import Divider from "@lib/components/Divider.svelte"
  import ModalHeader from "@lib/components/ModalHeader.svelte"
  import ModalFooter from "@lib/components/ModalFooter.svelte"
  import type {NWCInfo} from "@app/state"
  import {wallet, getWebLn} from "@app/state"
  import {pushToast} from "@app/toast"

  const back = () => history.back()

  const connectWithWebLn = async () => {
    loading = true

    try {
      await Promise.all([sleep(800), getWebLn().enable()])
      const info = await getWebLn().getInfo()

      if (!info?.supports?.includes("lightning")) {
        pushToast({
          theme: "error",
          message: "Your extension does not support lightning payments",
        })
      } else {
        wallet.set({type: "webln", info})
        pushToast({message: "Wallet successfully connected!"})

        await sleep(400)

        back()
      }
    } catch (e) {
      console.error(e)
      pushToast({
        theme: "error",
        message: "Wallet failed to connect",
      })
    } finally {
      loading = false
    }
  }

  const connectWithNWC = async () => {
    loading = true

    try {
      const client = new nwc.NWCClient({nostrWalletConnectUrl})
      const [_, info] = await Promise.all([sleep(800), client.getInfo()])

      if (!info) {
        pushToast({
          theme: "error",
          message: "Wallet failed to connect",
        })
      } else {
        wallet.set({type: "nwc", info: client.options as unknown as NWCInfo})
        pushToast({message: "Wallet successfully connected!"})

        await sleep(400)

        back()
      }
    } catch (e) {
      console.error(e)
      pushToast({
        theme: "error",
        message: "Wallet failed to connect",
      })
    } finally {
      loading = false
    }
  }

  const toggleScanner = () => {
    showScanner = !showScanner
  }

  const onScan = debounce(1000, async (data: string) => {
    showScanner = false
    nostrWalletConnectUrl = data
    await connectWithNWC()
  })

  let nostrWalletConnectUrl = $state("")
  let showScanner = $state(false)
  let loading = $state(false)
</script>

<div class="column gap-4">
  <ModalHeader>
    {#snippet title()}
      <div>Connect a Wallet</div>
    {/snippet}
    {#snippet info()}
      Use Nostr Wallet Connect to send Bitcoin payments over Lightning.
    {/snippet}
  </ModalHeader>
  {#if getWebLn()}
    <Button
      class="btn btn-primary"
      disabled={Boolean(nostrWalletConnectUrl || loading)}
      onclick={connectWithWebLn}>
      <Spinner loading={!nostrWalletConnectUrl && loading}>
        {#if !nostrWalletConnectUrl && loading}
          Connecting...
        {:else}
          <div class="flex items-center gap-2">
            <Icon icon="cpu" />
            Connect with WebLN
          </div>
        {/if}
      </Spinner>
    </Button>
    <Divider>Or</Divider>
  {/if}
  <Field>
    {#snippet label()}
      Connection Secret*
    {/snippet}
    {#snippet input()}
      <label class="input input-bordered flex w-full items-center gap-2">
        <Icon icon="lock" />
        <input
          bind:value={nostrWalletConnectUrl}
          autocomplete="off"
          name="flotilla-nwc"
          class="grow"
          type="password" />
        <Button onclick={toggleScanner}>
          <Icon icon="qr-code" />
        </Button>
      </label>
    {/snippet}
    {#snippet info()}
      You can find this in any wallet that supports
      <Link external href="https://nwc.getalby.com/about" class="text-primary"
        >Nostr Wallet Connect</Link
      >.
    {/snippet}
  </Field>
  {#if showScanner}
    <Scanner onscan={onScan} />
  {/if}
  <ModalFooter>
    <Button class="btn btn-link" onclick={back}>
      <Icon icon="alt-arrow-left" />
      Go back
    </Button>
    <Button
      class="btn btn-primary"
      disabled={!nostrWalletConnectUrl || loading}
      onclick={connectWithNWC}>
      <Spinner loading={Boolean(nostrWalletConnectUrl && loading)}>
        {#if nostrWalletConnectUrl && loading}
          Connecting...
        {:else}
          <div class="flex items-center gap-2">
            Connect Wallet
            <Icon icon="alt-arrow-right" />
          </div>
        {/if}
      </Spinner>
    </Button>
  </ModalFooter>
</div>
