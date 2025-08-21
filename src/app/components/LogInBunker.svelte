<script lang="ts">
  import {onMount, onDestroy} from "svelte"
  import type {Nip46ResponseWithResult} from "@welshman/signer"
  import {Nip46Broker, makeSecret} from "@welshman/signer"
  import {loginWithNip01, loginWithNip46} from "@welshman/app"
  import {preventDefault} from "@lib/html"
  import Spinner from "@lib/components/Spinner.svelte"
  import Button from "@lib/components/Button.svelte"
  import Icon from "@lib/components/Icon.svelte"
  import ModalHeader from "@lib/components/ModalHeader.svelte"
  import ModalFooter from "@lib/components/ModalFooter.svelte"
  import BunkerConnect from "@app/components/BunkerConnect.svelte"
  import BunkerUrl from "@app/components/BunkerUrl.svelte"
  import {Nip46Controller} from "@app/util/nip46"
  import {loadUserData} from "@app/core/requests"
  import {clearModals} from "@app/util/modal"
  import {setChecked} from "@app/util/notifications"
  import {pushToast} from "@app/util/toast"
  import {SIGNER_RELAYS, NIP46_PERMS} from "@app/core/state"

  const back = () => {
    if (mode === "connect") {
      selectBunker()
    } else {
      history.back()
    }
  }

  const controller = new Nip46Controller({
    onNostrConnect: async (response: Nip46ResponseWithResult) => {
      const pubkey = await controller.broker.getPublicKey()

      await loadUserData(pubkey)

      loginWithNip46(pubkey, controller.clientSecret, response.event.pubkey, SIGNER_RELAYS)
      setChecked("*")
      clearModals()
    },
  })

  const {loading, bunker} = controller

  const onSubmit = async () => {
    if ($loading) return

    try {
      const {signerPubkey, connectSecret, relays} = Nip46Broker.parseBunkerUrl($bunker)

      if (!signerPubkey || relays.length === 0) {
        return pushToast({
          theme: "error",
          message: "Sorry, it looks like that's an invalid bunker link.",
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

        await loadUserData(pubkey)

        loginWithNip46(pubkey, clientSecret, signerPubkey, relays)
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
    mode = "connect"
  }

  const selectBunker = () => {
    mode = "bunker"
  }

  let mode: string = $state("bunker")

  $effect(() => {
    // For testing and for play store reviewers
    if ($bunker === "reviewkey") {
      loginWithNip01(makeSecret())
    }
  })

  onMount(() => {
    controller.start()
  })

  onDestroy(() => {
    controller.stop()
  })
</script>

<form class="column gap-4" onsubmit={preventDefault(onSubmit)}>
  <ModalHeader>
    {#snippet title()}
      <div>Log In with a Signer</div>
    {/snippet}
    {#snippet info()}
      <div>Using a remote signer app helps you keep your keys safe.</div>
    {/snippet}
  </ModalHeader>
  <div class:hidden={mode !== "bunker"}></div>
  {#if mode === "connect"}
    <BunkerConnect {controller} />
  {:else}
    <BunkerUrl {controller} />
    <Button class="btn {$bunker ? 'btn-neutral' : 'btn-primary'}" onclick={selectConnect}
      >Log in with a QR code instead</Button>
  {/if}
  <ModalFooter>
    <Button class="btn btn-link" onclick={back} disabled={$loading}>
      <Icon icon="alt-arrow-left" />
      Go back
    </Button>
    {#if mode === "bunker"}
      <Button type="submit" class="btn btn-primary" disabled={$loading || !$bunker}>
        <Spinner loading={$loading}>Next</Spinner>
        <Icon icon="alt-arrow-right" />
      </Button>
    {/if}
  </ModalFooter>
</form>
