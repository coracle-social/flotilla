<script lang="ts">
  import cx from "classnames"
  import {Capacitor} from "@capacitor/core"
  import {onMount, onDestroy} from "svelte"
  import type {Nip46ResponseWithResult} from "@welshman/signer"
  import {Nip46Broker} from "@welshman/signer"
  import {makeSecret} from "@welshman/util"
  import {nip01, nip46, toSession} from "@welshman/app"
  import {preventDefault} from "@lib/html"
  import Spinner from "@lib/components/Spinner.svelte"
  import Button from "@lib/components/Button.svelte"
  import AltArrowLeft from "@assets/icons/alt-arrow-left.svg?dataurl"
  import AltArrowRight from "@assets/icons/alt-arrow-right.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Modal from "@lib/components/Modal.svelte"
  import ModalBody from "@lib/components/ModalBody.svelte"
  import ModalHeader from "@lib/components/ModalHeader.svelte"
  import ModalTitle from "@lib/components/ModalTitle.svelte"
  import ModalSubtitle from "@lib/components/ModalSubtitle.svelte"
  import ModalFooter from "@lib/components/ModalFooter.svelte"
  import BunkerConnect from "@app/components/BunkerConnect.svelte"
  import BunkerUrl from "@app/components/BunkerUrl.svelte"
  import {login} from "@app/core"
  import {Nip46Controller} from "@app/nip46"
  import {clearModals} from "@app/modal"
  import {setChecked} from "@app/notifications"
  import {pushToast} from "@app/toast"
  import {NIP46_PERMS} from "@app/nip46"

  const back = () => {
    if (mode === "connect") {
      selectBunker()
    } else {
      history.back()
    }
  }

  const controller = new Nip46Controller({
    onNostrConnect: async (response: Nip46ResponseWithResult) => {
      // Use the broker's current relays rather than the ones we started with, since
      // the signer may have asked us to switch relays during the connection handshake.
      await login(
        toSession(nip46, {
          clientSecret: controller.clientSecret,
          signerPubkey: response.event.pubkey,
          relays: controller.broker.params.relays,
        }),
      )

      setChecked("*")
      clearModals()
    },
  })

  const {loading, bunker} = controller

  const onSubmit = async () => {
    if ($loading) {
      return
    }

    try {
      const {signerPubkey, connectSecret, relays} = Nip46Broker.parseBunkerUrl($bunker)

      if (!signerPubkey) {
        return pushToast({
          theme: "error",
          message: "Sorry, it looks like that's an invalid bunker link.",
        })
      }

      if (relays.length === 0) {
        return pushToast({
          theme: "error",
          message: "That bunker link does not include any relays.",
        })
      }

      controller.loading.set(true)

      const {clientSecret} = controller
      const broker = new Nip46Broker({relays, clientSecret, signerPubkey})
      const result = await broker.connect(connectSecret, NIP46_PERMS)
      const pubkey = await broker.getPublicKey()

      // TODO: remove ack result
      if (pubkey && ["ack", connectSecret].includes(result)) {
        broker.cleanup()
        controller.stop()

        // connect() may have switched relays, so persist the broker's current relays.
        await login(toSession(nip46, {clientSecret, signerPubkey, relays: broker.params.relays}))
        setChecked("*")
      } else {
        return pushToast({
          theme: "error",
          message: "Something went wrong, please try again!",
        })
      }
    } catch (e) {
      console.error(e)

      return pushToast({
        theme: "error",
        message: "Something went wrong, please try again!",
      })
    } finally {
      controller.loading.set(false)
    }

    clearModals()
  }

  const selectConnect = () => {
    controller.loading.set(false)
    mode = "connect"
  }

  const openSigner = () => {
    controller.launchSigner()
  }

  const selectBunker = () => {
    mode = "bunker"
  }

  const isIos = Capacitor.getPlatform() === "ios"

  let mode: string = $state("bunker")

  $effect(() => {
    // For testing and for play store reviewers
    if ($bunker === "reviewkey") {
      login(toSession(nip01, {secret: makeSecret()}))
    }
  })

  onMount(() => {
    controller.start()
  })

  onDestroy(() => {
    controller.stop()
  })
</script>

<Modal tag="form" onsubmit={preventDefault(onSubmit)}>
  <ModalBody>
    <ModalHeader>
      <ModalTitle>Log In with a Signer</ModalTitle>
      <ModalSubtitle>Using a remote signer app helps you keep your keys safe.</ModalSubtitle>
    </ModalHeader>
    <div class:hidden={mode !== "bunker"}></div>
    {#if mode === "connect"}
      <BunkerConnect {controller} />
    {:else}
      <BunkerUrl {controller} />
      <Button class={cx(`button button-${$bunker ? "neutral" : "primary"}`)} onclick={selectConnect}
        >Log in with a QR code instead</Button>
      {#if isIos}
        <Button class="button button-neutral" onclick={openSigner}>Open in Signer</Button>
      {/if}
    {/if}
  </ModalBody>
  <ModalFooter>
    <Button class="button button-link" onclick={back} disabled={$loading}>
      <Icon icon={AltArrowLeft} />
      Go back
    </Button>
    {#if mode === "bunker"}
      <Button type="submit" class="button button-primary" disabled={$loading || !$bunker}>
        <Spinner loading={$loading}>Next</Spinner>
        <Icon icon={AltArrowRight} />
      </Button>
    {/if}
  </ModalFooter>
</Modal>
