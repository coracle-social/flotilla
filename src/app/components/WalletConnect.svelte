<script lang="ts">
  import {debounce} from "throttle-debounce"
  import {nwc} from "@getalby/sdk"
  import {sleep} from "@welshman/lib"
  import {WalletType} from "@welshman/util"
  import type {NWCInfo} from "@welshman/util"
  import {Profiles} from "@welshman/app"
  import Link from "@lib/components/Link.svelte"
  import Cpu from "@assets/icons/cpu-bolt.svg?dataurl"
  import Lock from "@assets/icons/lock-keyhole.svg?dataurl"
  import QrCode from "@assets/icons/qr-code.svg?dataurl"
  import AltArrowLeft from "@assets/icons/alt-arrow-left.svg?dataurl"
  import AltArrowRight from "@assets/icons/alt-arrow-right.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import Scanner from "@lib/components/Scanner.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import Field from "@lib/components/Field.svelte"
  import Modal from "@lib/components/Modal.svelte"
  import ModalBody from "@lib/components/ModalBody.svelte"
  import ModalHeader from "@lib/components/ModalHeader.svelte"
  import ModalTitle from "@lib/components/ModalTitle.svelte"
  import ModalSubtitle from "@lib/components/ModalSubtitle.svelte"
  import ModalFooter from "@lib/components/ModalFooter.svelte"
  import Divider from "@lib/components/Divider.svelte"
  import WalletAsReceivingAddress from "@app/components/WalletAsReceivingAddress.svelte"
  import {deriveUserItem} from "@app/core/app"
  import {getWebLn, wallet} from "@app/features/lightning"
  import {pushToast} from "@app/ui/toast"
  import {pushModal} from "@app/ui/modal"

  const userProfile = deriveUserItem(Profiles)

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
        wallet.set({type: WalletType.WebLN, info})
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
        wallet.set({type: WalletType.NWC, info: client.options as unknown as NWCInfo})
        pushToast({message: "Wallet successfully connected!"})

        await sleep(400)

        back()

        if (info.lud16 && info.lud16 !== $userProfile?.values.lud16) {
          pushModal(WalletAsReceivingAddress)
        }
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

<Modal>
  <ModalBody>
    <ModalHeader>
      <ModalTitle>Connect a Wallet</ModalTitle>
      <ModalSubtitle
        >Use Nostr Wallet Connect to send Bitcoin payments over lightning.</ModalSubtitle>
    </ModalHeader>
    {#if getWebLn()}
      <Button
        class="button button-primary"
        disabled={Boolean(nostrWalletConnectUrl || loading)}
        onclick={connectWithWebLn}>
        <Spinner loading={!nostrWalletConnectUrl && loading}>
          {#if !nostrWalletConnectUrl && loading}
            Connecting...
          {:else}
            <div class="flex items-center gap-2">
              <Icon icon={Cpu} />
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
        <label class="input flex w-full items-center gap-2">
          <Icon icon={Lock} />
          <input
            bind:value={nostrWalletConnectUrl}
            autocomplete="off"
            name="flotilla-nwc"
            class="grow"
            type="password" />
          <Button onclick={toggleScanner}>
            <Icon icon={QrCode} />
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
  </ModalBody>
  <ModalFooter>
    <Button class="button button-link" onclick={back}>
      <Icon icon={AltArrowLeft} />
      Go back
    </Button>
    <Button
      class="button button-primary"
      disabled={!nostrWalletConnectUrl || loading}
      onclick={connectWithNWC}>
      <Spinner loading={Boolean(nostrWalletConnectUrl && loading)}>
        {#if nostrWalletConnectUrl && loading}
          Connecting...
        {:else}
          <div class="flex items-center gap-2">
            Connect Wallet
            <Icon icon={AltArrowRight} />
          </div>
        {/if}
      </Spinner>
    </Button>
  </ModalFooter>
</Modal>
